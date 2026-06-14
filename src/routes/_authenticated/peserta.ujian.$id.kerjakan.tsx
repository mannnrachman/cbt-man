import { createFileRoute, useParams, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ujianRepo, sesiRepo, soalRepo, hydrateRepos } from "@/lib/cbt/repos";
import { useAuthStore } from "@/lib/cbt/auth-store";
import { gradeSesi } from "@/lib/cbt/exam";
import type { SesiUjian, JawabanSesi } from "@/lib/cbt/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { RichView } from "@/components/cbt/RichEditor";
import { AudioPlayer } from "@/components/cbt/AudioPlayer";
import { cn } from "@/lib/utils";
import { Flag, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/peserta/ujian/$id/kerjakan")({
  loader: async () => {
    try {
      await hydrateRepos();
    } catch {
      // Fallback ke cache; jangan brick navigasi saat snapshot gagal.
    }
  },
  component: Kerjakan,
});

function Kerjakan() {
  const { id } = useParams({ from: "/_authenticated/peserta/ujian/$id/kerjakan" });
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const ujian = ujianRepo.byId(id);
  const initSesi = useMemo(
    () =>
      user
        ? sesiRepo
            .all()
            .find((s) => s.ujianId === id && s.pesertaId === user.id && s.status === "sedang")
        : undefined,
    [id, user],
  );
  const [sesi, setSesi] = useState<SesiUjian | null>(initSesi ?? null);
  const [idx, setIdx] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const submittingRef = useRef(false);
  const sesiRef = useRef<SesiUjian | null>(initSesi ?? null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mirror sesi ke ref agar callback async (beforeunload, debounce) baca nilai terbaru.
  useEffect(() => {
    sesiRef.current = sesi;
  }, [sesi]);

  // Debounced persist: tulis sesi ke server setelah jeda, coalesce tulisan cepat.
  function persistSesi(next: SesiUjian, delay = 500) {
    if (submittingRef.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      if (!submittingRef.current) sesiRepo.upsert(next);
    }, delay);
  }

  // Best-effort flush saat tab ditutup / navigasi keluar (di luar submit).
  useEffect(() => {
    function onBeforeUnload() {
      if (submittingRef.current) return;
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
        if (sesiRef.current) sesiRepo.upsert(sesiRef.current);
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  // Timer
  useEffect(() => {
    if (!sesi?.endsAt) return;
    const tick = () => {
      const r = Math.max(0, (sesi.endsAt as number) - Date.now());
      setRemaining(r);
      if (r === 0 && !submittingRef.current) void submit("waktu habis");
    };
    tick();
    const t = window.setInterval(tick, 500);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sesi?.endsAt]);

  // Anti-cheat
  useEffect(() => {
    if (!ujian) return;
    function onVisibility() {
      if (document.visibilityState === "hidden" && sesiRef.current) {
        const next = { ...sesiRef.current, pelanggaran: sesiRef.current.pelanggaran + 1 };
        setSesi(next);
        persistSesi(next);
        if (next.pelanggaran > 0 && !submittingRef.current) {
          const activeUjian = ujianRepo.byId(id);
          if (
            activeUjian &&
            activeUjian.maxPindahTab > 0 &&
            next.pelanggaran > activeUjian.maxPindahTab
          ) {
            void submit("terlalu sering pindah tab");
          }
        }
      }
    }
    function onContext(e: MouseEvent) {
      if (ujianRepo.byId(id)?.blokirShortcut) e.preventDefault();
    }
    function onKey(e: KeyboardEvent) {
      if (!ujianRepo.byId(id)?.blokirShortcut) return;
      if ((e.ctrlKey || e.metaKey) && ["c", "v", "p", "u", "s"].includes(e.key.toLowerCase()))
        e.preventDefault();
    }
    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("contextmenu", onContext);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("contextmenu", onContext);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ujian, sesi?.id]);

  if (!user) {
    return <div className="p-6">Anda harus login terlebih dahulu.</div>;
  }

  if (!ujian || !sesi) {
    return (
      <div className="p-6">
        Sesi tidak ditemukan.{" "}
        <Link to="/peserta" className="text-primary">
          Kembali
        </Link>
      </div>
    );
  }

  const soalId = sesi.soalIds[idx];
  const soal = soalId ? soalRepo.byId(soalId) : undefined;
  const j = sesi.jawaban[idx];

  if (!soal || !j) {
    return (
      <div className="p-6 space-y-3">
        <div className="font-medium">Data soal sesi tidak lengkap.</div>
        <div className="text-sm text-muted-foreground">
          Silakan kembali ke dashboard peserta dan mulai ulang sesi jika diperlukan.
        </div>
        <Link to="/peserta" className="text-primary">
          Kembali
        </Link>
      </div>
    );
  }

  const currentUser = user;
  const currentUjian = ujian;
  const currentSesi = sesi;
  const currentSoal = soal;
  const currentJawaban = j;
  const optOrder = currentSesi.jawabanOrder[currentSoal.id] ?? currentSoal.jawaban.map((o) => o.id);

  function updateJawaban(patch: Partial<JawabanSesi>) {
    const next: SesiUjian = {
      ...currentSesi,
      jawaban: currentSesi.jawaban.map((x, i) => (i === idx ? { ...x, ...patch } : x)),
    };
    setSesi(next);
    persistSesi(next);
  }

  function toggleOption(jawabanId: string) {
    if (currentSoal.tipe === "pg" || currentSoal.tipe === "bs") {
      updateJawaban({ jawabanIds: [jawabanId] });
    } else if (currentSoal.tipe === "multi") {
      const has = currentJawaban.jawabanIds.includes(jawabanId);
      updateJawaban({
        jawabanIds: has
          ? currentJawaban.jawabanIds.filter((x) => x !== jawabanId)
          : [...currentJawaban.jawabanIds, jawabanId],
      });
    }
  }

  async function submit(reason?: string) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      // Buang tulisan debounce tertunda agar tidak menimpa sesi graded setelahnya.
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      // Pakai sesiRef agar auto-submit (timer/anti-cheat) tidak menilai sesi stale
      // (timer effect bind sekali di mount; closure currentSesi bisa ketinggalan).
      const graded = gradeSesi(sesiRef.current ?? currentSesi, currentUjian);
      sesiRepo.upsert(graded);
      const result = await sesiRepo.flush();
      if (!result.ok) {
        toast.error("Gagal menyimpan jawaban. Coba kumpulkan lagi.");
        submittingRef.current = false;
        return;
      }
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      toast.success(reason ? `Ujian disubmit (${reason})` : "Ujian berhasil disubmit");
      navigate({ to: "/peserta/ujian/$id/hasil", params: { id: currentUjian.id } });
    } catch {
      toast.error("Gagal menyimpan jawaban. Coba kumpulkan lagi.");
      submittingRef.current = false;
    }
  }

  const mm = Math.floor(remaining / 60000);
  const ss = Math.floor((remaining % 60000) / 1000);
  const danger = remaining < 60_000;

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="sticky top-0 z-10 border-b bg-card">
        <div className="container mx-auto flex items-center justify-between gap-3 px-4 py-2">
          <div className="text-sm">
            <div className="font-medium">{currentUjian.nama}</div>
            <div className="text-xs text-muted-foreground">
              {currentUser.namaLengkap} · Soal {idx + 1} / {currentSesi.soalIds.length}
            </div>
          </div>
          <div
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 font-mono text-lg font-bold tabular-nums",
              danger
                ? "bg-destructive text-destructive-foreground"
                : "bg-accent text-accent-foreground",
            )}
          >
            <Clock className="h-5 w-5" />
            {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
          </div>
        </div>
      </header>

      <div className="container mx-auto grid gap-4 p-4 lg:grid-cols-[1fr_280px]">
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="text-xs text-muted-foreground">
              Soal #{idx + 1} · {currentSoal.tipe}
            </div>
            <RichView html={currentSoal.detail} />
            {currentSoal.audioFileId && (
              <AudioPlayer
                fileId={currentSoal.audioFileId}
                playOnce={currentSoal.audioPlayOnce}
                storageKey={`cbtman:audio:${currentSesi.id}:${currentSoal.id}`}
              />
            )}

            {currentSoal.tipe === "essay" ? (
              <Textarea
                rows={6}
                value={currentJawaban.jawabanEssay}
                onChange={(e) => updateJawaban({ jawabanEssay: e.target.value })}
                placeholder="Tulis jawaban Anda…"
              />
            ) : (
              <div className="space-y-2">
                {optOrder.map((oid, i) => {
                  const opt = currentSoal.jawaban.find((x) => x.id === oid);
                  if (!opt) return null;
                  const checked = currentJawaban.jawabanIds.includes(oid);
                  return (
                    <button
                      key={oid}
                      onClick={() => toggleOption(oid)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-md border p-3 text-left transition",
                        checked ? "border-primary bg-primary/5" : "hover:bg-muted/40",
                      )}
                    >
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-medium">
                        {String.fromCharCode(65 + i)}
                      </span>
                      <RichView html={opt.detail} className="prose prose-sm max-w-none" />
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={currentJawaban.ragu}
                  onCheckedChange={(v) => updateJawaban({ ragu: !!v })}
                />
                <Flag className="h-4 w-4 text-warning" /> Ragu-ragu
              </label>
              <div className="flex gap-2">
                <Button variant="outline" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>
                  Sebelumnya
                </Button>
                {idx < currentSesi.soalIds.length - 1 ? (
                  <Button onClick={() => setIdx(idx + 1)}>Berikutnya</Button>
                ) : (
                  <Button
                    onClick={() => {
                      if (confirm("Kumpulkan jawaban?")) void submit();
                    }}
                  >
                    Kumpulkan
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="text-sm font-medium">Navigasi Soal</div>
            <div className="grid grid-cols-5 gap-1.5">
              {currentSesi.soalIds.map((_, i) => {
                const a = currentSesi.jawaban[i];
                const dijawab = a.jawabanIds.length > 0 || a.jawabanEssay.length > 0;
                return (
                  <button
                    key={i}
                    onClick={() => setIdx(i)}
                    className={cn(
                      "h-9 rounded text-xs font-medium border transition",
                      i === idx && "ring-2 ring-primary",
                      a.ragu
                        ? "bg-warning/20 border-warning/40"
                        : dijawab
                          ? "bg-success/20 border-success/40"
                          : "bg-muted",
                    )}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <div>
                <span className="inline-block h-3 w-3 rounded bg-success/30 mr-1" />
                Dijawab
              </div>
              <div>
                <span className="inline-block h-3 w-3 rounded bg-warning/30 mr-1" />
                Ragu-ragu
              </div>
              <div>
                <span className="inline-block h-3 w-3 rounded bg-muted mr-1 border" />
                Belum
              </div>
            </div>
            {currentSesi.pelanggaran > 0 && (
              <div className="rounded bg-destructive/10 p-2 text-xs text-destructive">
                ⚠ {currentSesi.pelanggaran}× pindah tab terdeteksi (max {currentUjian.maxPindahTab})
              </div>
            )}
            <Button
              variant="destructive"
              size="sm"
              className="w-full"
              onClick={() => {
                if (confirm("Kumpulkan sekarang?")) void submit();
              }}
            >
              Kumpulkan Sekarang
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
