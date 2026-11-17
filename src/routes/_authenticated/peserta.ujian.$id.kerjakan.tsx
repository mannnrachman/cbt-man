import { useAuthStore } from "@/lib/cbt/auth-store";
import { soalBySessionId, sesiRepo, ujianRepo, getParticipantSessionState, invalidateReposCache, hydrateRepos, saveParticipantSession } from "@/lib/cbt/repos";
import { armExamAlarm, startExamAlarm, stopExamAlarm } from "@/lib/cbt/exam-alarm";
import {
  examScreenPhase,
  nextSaveState,
  SAVE_STATE_LABELS,
  type SaveEvent,
  type SaveState,
} from "@/lib/cbt/state-machines";
import { reportExamViolation } from "@/lib/server/sesi/functions";
import type { SesiUjian, Ujian } from "@/lib/cbt/types";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { LayoutGrid, X, ChevronLeft, ChevronRight, Flag, CheckCircle2, Type, Clock, Calculator, FileText } from "lucide-react";
import {
  createFileRoute,
  useNavigate,
  useParams,
} from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AudioPlayer } from "@/components/cbt/AudioPlayer";
import { RichView } from "@/components/cbt/RichEditor";
import { ExamCalculator } from "@/components/cbt/ExamCalculator";
import { NilaiNormalTable } from "@/components/cbt/NilaiNormal";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute(
  "/_authenticated/peserta/ujian/$id/kerjakan",
)({
  component: RouteComponent,
  loader: async () => {
    invalidateReposCache();
    return null;
  },
});


function NilaiNormalAction({ ujian }: { ujian: Ujian }) {
  if (!ujian.allowNilaiNormal) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="mt-2 w-full">
          <FileText className="mr-2 h-4 w-4" aria-hidden="true" />
          Tabel Nilai Normal
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tabel Nilai Normal Laboratorium</DialogTitle>
        </DialogHeader>
        <NilaiNormalTable />
      </DialogContent>
    </Dialog>
  );
}

function RouteComponent() {
  const { id } = useParams({ strict: false });
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const ujian = ujianRepo.all().find((u) => u.id === id);

  const [sesiDicari, setSesiDicari] = useState(false);
  const [sesi, setSesi] = useState<SesiUjian | null>(null);

  const [idx, setIdx] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [pollingError, setPollingError] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveState>("clean");
  const dispatchSave = (event: SaveEvent) => setSaveStatus((prev) => nextSaveState(prev, event));
  const submittingRef = useRef(false);
  const saveTimer = useRef<NodeJS.Timeout | null>(null);

  const [showList, setShowList] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [examLocked, setExamLocked] = useState(false);
  const [fontSize, setFontSize] = useState<"sm" | "base" | "lg">("base");
  const [rightTab, setRightTab] = useState<"navigasi" | "kalkulator">("navigasi");
  const [mobileTab, setMobileTab] = useState<"navigasi" | "kalkulator">("navigasi");

  useEffect(() => {
    if (!user || !ujian) return;
    const active = sesiRepo.all().find(
      (x) => x.ujianId === ujian.id && x.pesertaId === user.id && x.status === "sedang"
    );
    setSesi(active || null);
    setSesiDicari(true);
  }, [user, ujian]);

  useEffect(() => {
    if (examLocked) return;
    if (sesi && sesi.status === "selesai") {
      navigate({
        to: "/peserta/ujian/$id/hasil",
        params: { id: sesi.ujianId },
      });
    }
  }, [sesi, navigate, examLocked]);

  const endsAt = useMemo(() => {
    if (!sesi || !ujian) return 0;
    if (sesi.endsAt) return sesi.endsAt;
    const start = sesi.mulaiAt || Date.now();
    return start + (ujian.durasiMenit || 60) * 60 * 1000;
  }, [sesi, ujian]);

  const remaining = Math.max(0, endsAt - now);

  const sesiRef = useRef(sesi);
  const showListRef = useRef(showList);
  const examLockedRef = useRef(examLocked);
  const leaveInFlightRef = useRef(false);
  const leaveQuietUntilRef = useRef(0);
  useEffect(() => {
    sesiRef.current = sesi;
  }, [sesi]);
  useEffect(() => {
    showListRef.current = showList;
  }, [showList]);
  useEffect(() => {
    examLockedRef.current = examLocked;
  }, [examLocked]);

  const activeSesiId = sesi?.id;
  const activeSesiStatus = sesi?.status;
  const activeUjianId = ujian?.id;

  useEffect(() => {
    if (!ujian?.blokirShortcut || activeSesiStatus !== "sedang") return;
    const blockShortcut = (event: Event) => {
      event.preventDefault();
    };
    document.addEventListener("copy", blockShortcut);
    document.addEventListener("cut", blockShortcut);
    document.addEventListener("paste", blockShortcut);
    document.addEventListener("contextmenu", blockShortcut);
    return () => {
      document.removeEventListener("copy", blockShortcut);
      document.removeEventListener("cut", blockShortcut);
      document.removeEventListener("paste", blockShortcut);
      document.removeEventListener("contextmenu", blockShortcut);
    };
  }, [ujian?.blokirShortcut, activeSesiStatus]);

  useEffect(() => {
    const arm = () => armExamAlarm();
    window.addEventListener("pointerdown", arm, { once: true });
    window.addEventListener("keydown", arm, { once: true });
    return () => {
      window.removeEventListener("pointerdown", arm);
      window.removeEventListener("keydown", arm);
      stopExamAlarm();
    };
  }, []);

  useEffect(() => {
    if (!activeSesiId || activeSesiStatus !== "sedang") return;

    let isSubscribed = true;

    const inPageOverlayOpen = () => {
      if (showListRef.current) return true;
      return Boolean(document.querySelector('[role="dialog"]'));
    };

    const reportLeave = async () => {
      if (!isSubscribed || submittingRef.current) return;
      if (examLockedRef.current || leaveInFlightRef.current) return;
      if (Date.now() < leaveQuietUntilRef.current) return;
      if (sesiRef.current?.status !== "sedang") return;
      leaveInFlightRef.current = true;
      leaveQuietUntilRef.current = Date.now() + 1500;
      try {
        const pending = sesiRef.current;
        if (pending) {
          await saveParticipantSession(pending);
        }
        if (!isSubscribed || submittingRef.current) return;
        const result = await reportExamViolation({ data: { sesiId: activeSesiId } });
        if (!isSubscribed || submittingRef.current) return;
        if (result.ok && result.locked) {
          examLockedRef.current = true;
          setExamLocked(true);
          startExamAlarm();
          try {
            await useAuthStore.getState().logout();
          } catch {
            /* cookie/session already revoked */
          }
        }
      } catch {
        /* leave report is best-effort; next leave retries */
      } finally {
        leaveInFlightRef.current = false;
      }
    };

    let blurTimer: number | null = null;
    const onVisibility = () => {
      if (document.hidden) void reportLeave();
    };
    const onBlur = () => {
      if (blurTimer !== null) window.clearTimeout(blurTimer);
      blurTimer = window.setTimeout(() => {
        blurTimer = null;
        if (!isSubscribed || submittingRef.current) return;
        if (document.hasFocus()) return;
        if (inPageOverlayOpen()) return;
        // Verify document is genuinely not focused and either hidden or active element is body/null
        void reportLeave();
      }, 250);
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    return () => {
      isSubscribed = false;
      if (blurTimer !== null) window.clearTimeout(blurTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
    };
  }, [activeSesiId, activeSesiStatus]);

  useEffect(() => {
    if (!activeSesiId || !activeUjianId || activeSesiStatus === "selesai") return;
    const interval = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= endsAt) {
        clearInterval(interval);
        submit("Waktu Habis");
      }
    }, 1000);

    let pollInFlight = false;
    let pollingActive = true;
    const pollInterval = setInterval(async () => {
      if (pollInFlight) return;
      pollInFlight = true;
      try {
        const result = await getParticipantSessionState(activeSesiId);
        if (!pollingActive) return;
        if (result.ok) {
          setPollingError(false);
          if (result.sesi.status === "selesai") {
            if (examLockedRef.current) return;
            invalidateReposCache();
            await hydrateRepos();
            if (!pollingActive) return;
            toast.warning("Ujian telah dihentikan oleh pengawas.");
            navigate({
              to: "/peserta/ujian/$id/hasil",
              params: { id: activeUjianId },
            });
          } else if (result.sesi.endsAt && sesiRef.current && result.sesi.endsAt !== sesiRef.current.endsAt) {
            // Safely merge endsAt without wiping local un-flushed answers
            setSesi(prev => prev ? { ...prev, endsAt: result.sesi.endsAt } : prev);
            toast.info("Waktu ujian Anda telah diperbarui oleh pengawas.");
          }
        } else {
          setPollingError(true);
        }
      } catch {
        if (pollingActive) setPollingError(true);
      } finally {
        pollInFlight = false;
      }
    }, 10000);

    const handleBeforeUnload = () => {
      if (sesiRef.current) {
        void saveParticipantSession(sesiRef.current);
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      pollingActive = false;
      clearInterval(interval);
      clearInterval(pollInterval);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSesiId, activeSesiStatus, activeUjianId, endsAt]);

  function updateJawaban(partial: Partial<SesiUjian["jawaban"][0]>) {
    if (!sesi) return;
    dispatchSave("edit");
    const nextSesi = { ...sesi };
    nextSesi.jawaban = [...nextSesi.jawaban];
    nextSesi.jawaban[idx] = { ...nextSesi.jawaban[idx], ...partial };
    // Keep the ref in sync synchronously: submit() reads sesiRef.current and
    // must never finalize a session missing the very latest answer (the
    // useEffect-based sync only runs after the next render commit).
    sesiRef.current = nextSesi;
    setSesi(nextSesi);

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      dispatchSave("flush");
      void saveParticipantSession(nextSesi).then((result) => {
        dispatchSave(result.ok ? "success" : "failure");
        if (result.ok || sesiRef.current !== nextSesi) return;
        const restored = sesiRepo.byId(nextSesi.id) ?? null;
        sesiRef.current = restored;
        setSesi(restored);
      });
    }, 2000);
  }

  function toggleOption(jawabanId: string) {
    if (!sesi || !soal) return;
    const currentJawaban = sesi.jawaban[idx];
    const currentSoal = soal;
    let nextJawabanIds: string[];

    if (currentSoal.tipe === "multi") {
      const has = currentJawaban.jawabanIds.includes(jawabanId);
      nextJawabanIds = has
        ? currentJawaban.jawabanIds.filter((x) => x !== jawabanId)
        : [...currentJawaban.jawabanIds, jawabanId];
    } else {
      nextJawabanIds = [jawabanId];
    }

    updateJawaban({ jawabanIds: nextJawabanIds });
  }

  function handleNavigateIdx(newIdx: number) {
    if (!sesi) return;
    // Flush pending answer updates before moving to the next question
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      if (sesiRef.current) {
        const pending = sesiRef.current;
        dispatchSave("flush");
        void saveParticipantSession(pending).then((result) => {
          dispatchSave(result.ok ? "success" : "failure");
          if (result.ok || sesiRef.current !== pending) return;
          const restored = sesiRepo.byId(pending.id) ?? null;
          sesiRef.current = restored;
          setSesi(restored);
        });
      }
    }
    setIdx(newIdx);
  }

  async function submit(reason?: string) {
    if (submittingRef.current || !ujian || !sesiRef.current) return;
    submittingRef.current = true;
    try {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      dispatchSave("flush");
      const result = await saveParticipantSession(sesiRef.current, true);
      if (!result.ok) {
        dispatchSave("failure");
        toast.error("Gagal menyimpan jawaban. Coba kumpulkan lagi.");
        submittingRef.current = false;
        return;
      }
      dispatchSave("success");
      // Re-hydrate from the server so the hasil page reads the authoritative
      // server-computed score and the post-submit snapshot (answer keys and
      // pembahasan are only exposed after selesai when the exam allows it).
      // Non-fatal: the submit already persisted; a fresh load re-fetches.
      try {
        invalidateReposCache();
        await hydrateRepos();
      } catch {
        invalidateReposCache();
      }
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      toast.success(
        reason ? `Ujian disubmit (${reason})` : "Ujian berhasil disubmit",
      );
      navigate({
        to: "/peserta/ujian/$id/hasil",
        params: { id: ujian.id },
      });
    } catch {
      dispatchSave("failure");
      toast.error("Gagal menyimpan jawaban. Coba kumpulkan lagi.");
      submittingRef.current = false;
    }
  }

  const soalId = sesi?.soalIds[idx];
  const soal = sesi && soalId ? soalBySessionId(sesi.id, soalId) : undefined;
  const j = sesi?.jawaban[idx];
  // Render order is owned by the explicit exam-screen machine
  // (src/lib/cbt/state-machines.ts): locked → no-user → no-exam → loading →
  // no-session → no-question → running.
  const phase = examScreenPhase({
    examLocked,
    user,
    ujian,
    sesiDicari,
    sesi,
    soalReady: Boolean(soal && j),
  });

  if (phase === "locked") {
    return (
      <div className="flex h-screen items-center justify-center bg-background p-6">
        <div
          role="alert"
          className="max-w-md rounded-lg border border-destructive/40 bg-card p-6 text-destructive"
        >
          <h1 className="text-lg font-semibold">Sesi ujian dikunci</h1>
          <p className="mt-2 text-sm leading-relaxed">
            Anda meninggalkan halaman ujian melebihi batas. Jawaban dikumpulkan dan sesi diakhiri.
          </p>
        </div>
      </div>
    );
  }

  if (phase === "no-user") return <div className="p-8 text-center font-medium">Anda harus login.</div>;
  if (phase === "no-exam") return <div className="p-8 text-center font-medium">Data ujian tidak ditemukan.</div>;
  if (phase === "loading") return <div className="flex h-screen items-center justify-center bg-background"><div className="flex flex-col items-center gap-4"><div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin" /><p className="text-ui text-muted-foreground">Menyiapkan ujian…</p></div></div>;
  if (phase === "no-session") return <div className="p-8 text-center font-medium">Sesi tidak valid.</div>;
  if (phase === "no-question") return <div className="p-8 text-center font-medium">Soal bermasalah.</div>;
  // phase === "running": narrow the optionals for the render below
  if (!user || !ujian || !sesi || !soal || !j) return null;

  const currentSesi = sesi;
  const currentSoal = soal;
  const currentJawaban = j;
  const optOrder = currentSesi.jawabanOrder[currentJawaban.soalId] ?? currentSoal.jawaban.map((o) => o.id);

  const mm = Math.floor(remaining / 60000);
  const ss = Math.floor((remaining % 60000) / 1000);
  const danger = remaining < 300_000; // < 5 minutes
  const critical = remaining < 60_000; // < 1 minute

  const textSizeClass = 
    fontSize === "sm" ? "text-sm sm:text-base prose-sm" : 
    fontSize === "lg" ? "text-xl sm:text-2xl prose-xl" : "text-base sm:text-lg prose-base";

  return (
    <div className="flex flex-col h-[calc(100dvh-64px)] overflow-hidden bg-background font-sans p-0 sm:p-3 lg:p-5">
      <div className="flex-1 flex mx-auto w-full max-w-[1600px] h-full min-h-0 relative overflow-hidden rounded-none sm:rounded-lg border-0 sm:border bg-card">

        {/* LEFT PANEL: MAIN EXAM AREA */}
        <div className="flex-1 flex flex-col min-w-0 bg-card relative z-10">
          
          {/* Top Sticky Header */}
          <div className="sticky top-0 z-20 bg-card border-b border-border px-4 sm:px-8 py-3 sm:py-4 flex items-center justify-between transition-colors">
            
            <div className="min-w-0">
              <p className="max-w-[22rem] truncate text-ui font-medium text-foreground" title={ujian.nama}>{ujian.nama}</p>
              <p className="text-label text-muted-foreground tabular-nums">Soal {idx + 1} dari {currentSesi.soalIds.length}</p>
            </div>

            <div className="flex items-center gap-3 sm:gap-6">
              {/* Font Size Controls */}
              <div className="hidden sm:flex items-center gap-1 bg-muted p-1 rounded-lg border border-border">
                <button type="button" onClick={() => setFontSize("sm")} className={cn("flex items-center justify-center w-8 h-8 rounded-lg font-semibold text-sm transition-all", fontSize === "sm" ? "bg-card text-primary" : "text-muted-foreground hover:text-foreground")} aria-label="Perkecil teks" title="Perkecil teks">
                  <Type className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => setFontSize("base")} className={cn("flex items-center justify-center w-8 h-8 rounded-lg font-semibold text-base transition-all", fontSize === "base" ? "bg-card text-primary" : "text-muted-foreground hover:text-foreground")} aria-label="Gunakan ukuran teks normal" title="Gunakan ukuran teks normal">
                  <Type className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => setFontSize("lg")} className={cn("flex items-center justify-center w-8 h-8 rounded-lg font-semibold text-lg transition-all", fontSize === "lg" ? "bg-card text-primary" : "text-muted-foreground hover:text-foreground")} aria-label="Perbesar teks" title="Perbesar teks">
                  <Type className="w-5 h-5" />
                </button>
              </div>

              {/* Timer */}
              <div className={cn(
                "flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-1.5 rounded-lg border transition-colors",
                critical ? "bg-destructive text-destructive-foreground border-destructive" : 
                danger ? "bg-destructive/10 text-destructive border-destructive/30" : 
                "bg-muted text-foreground border-border"
              )}>
                <Clock className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
                <span className="flex flex-col leading-tight">
                  <span className="font-mono text-heading font-semibold tabular-nums">
                    {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
                  </span>
                  <span className={cn("whitespace-nowrap text-label", !danger && "hidden sm:inline")}>
                    {critical ? "Kurang dari 1 menit" : danger ? "Kurang dari 5 menit" : "Sisa waktu"}
                  </span>
                </span>
              </div>

              {saveStatus !== "clean" && (
                <p
                  role="status"
                  className={cn(
                    "max-w-[10rem] text-right text-label font-medium leading-tight",
                    saveStatus === "failed" ? "text-warn" : "text-muted-foreground",
                  )}
                >
                  {SAVE_STATE_LABELS[saveStatus]}
                </p>
              )}

              {pollingError && (
                <p role="status" className="max-w-[9rem] text-right text-label font-medium leading-tight text-warn sm:text-label">
                  Sinkronisasi tertunda — mencoba lagi.
                </p>
              )}

              {/* Quick toggle button for Calculator on Desktop */}
              {ujian.allowCalculator && (
                <Button
                  variant={rightTab === "kalkulator" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRightTab((prev) => (prev === "kalkulator" ? "navigasi" : "kalkulator"))}
                  className="hidden md:inline-flex items-center gap-1.5 h-9 px-3 rounded-lg font-semibold text-label transition-all"
                  title={rightTab === "kalkulator" ? "Kembali ke Navigasi Soal" : "Buka Kalkulator di Panel Kanan"}
                  aria-label={rightTab === "kalkulator" ? "Tutup kalkulator di panel kanan" : "Buka kalkulator di panel kanan"}
                >
                  <Calculator className="w-3.5 h-3.5" />
                  <span>{rightTab === "kalkulator" ? "Tutup Kalkulator" : "Kalkulator"}</span>
                </Button>
              )}

              <Button variant="outline" size="icon" className="md:hidden w-10 h-10 rounded-lg border-border" onClick={() => setShowList(true)} aria-label="Buka daftar soal" title="Buka daftar soal">
                <LayoutGrid className="w-5 h-5 text-muted-foreground" />
              </Button>
            </div>
          </div>

          {/* Question & Options Scrollable Area */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden relative bg-background">
            <div className="max-w-5xl mx-auto px-5 sm:px-10 py-6 sm:py-10 pb-32">

              {/* Question Text */}
              <div 
                aria-live="polite"
                className={cn("prose prose-slate dark:prose-invert max-w-none mb-10 text-foreground leading-loose", textSizeClass)}
              >
                <RichView html={currentSoal.detail} />
              </div>
              
              {/* Audio Player if present */}
              {currentSoal.audioFileId && (
                <div className="mb-10 rounded-lg border border-border bg-card p-6">
                  <p className="mb-4 text-ui font-medium text-muted-foreground">Audio pendukung</p>
                  <AudioPlayer
                    fileId={currentSoal.audioFileId}
                    playOnce={currentSoal.audioPlayOnce}
                    storageKey={`cbtman:audio:${currentSesi.id}:${currentSoal.id}`}
                  />
                </div>
              )}

              {/* Options / Essay Input */}
              <div className="space-y-4">
                {currentSoal.tipe === "essay" ? (
                  <div className="space-y-2">
                    <div className="rounded-lg border border-border bg-card focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                      <Textarea
                        rows={10}
                        aria-label={`Jawaban esai soal nomor ${idx + 1}`}
                        value={currentJawaban.jawabanEssay ?? ""}
                        onChange={(e) => updateJawaban({ jawabanEssay: e.target.value })}
                        placeholder="Ketik jawaban esai Anda secara lengkap dan jelas di sini..."
                        className={cn(
                          "w-full resize-y rounded-t-lg border-0 bg-transparent p-4 sm:p-5 text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:outline-none min-h-[220px] leading-relaxed",
                          textSizeClass
                        )}
                      />
                      <div className="flex items-center justify-between border-t border-border px-4 py-2.5 bg-muted/60 text-label text-muted-foreground rounded-b-lg select-none">
                        <span>Jawaban tersimpan otomatis</span>
                        <span>
                          {((currentJawaban.jawabanEssay ?? "").trim() ? (currentJawaban.jawabanEssay ?? "").trim().split(/\s+/).length : 0)} kata · {(currentJawaban.jawabanEssay ?? "").length} karakter
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  optOrder.map((oid, i) => {
                    const opt = currentSoal.jawaban.find((x) => x.id === oid);
                    if (!opt) return null;
                    const isChecked = currentJawaban.jawabanIds.includes(oid);
                    const optLetter = String.fromCharCode(65 + i);

                    return (
                      <label 
                        key={oid}
                        className={cn(
                          "group relative flex items-start p-4 sm:p-5 rounded-lg border cursor-pointer transition-colors",
                          "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background", // a11y focus ring
                          isChecked 
                            ? "border-2 border-primary bg-primary/10"
                            : "border-foreground/30 bg-card hover:bg-accent"
                        )}
                      >
                        <input
                          type={currentSoal.tipe === "multi" ? "checkbox" : "radio"}
                          name={`soal-${currentSoal.id}`}
                          className="sr-only"
                          checked={isChecked}
                          onChange={() => toggleOption(oid)}
                        />
                        
                        <div className="flex shrink-0 items-center justify-center mt-0.5 sm:mt-1 mr-4 sm:mr-6">
                          <div className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-md border font-semibold transition-colors sm:h-9 sm:w-9",
                            isChecked
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-foreground/30 bg-muted text-muted-foreground"
                          )}>
                            {optLetter}
                          </div>
                        </div>

                        <div className={cn(
                          "flex-1 min-w-0 pt-1 prose prose-slate dark:prose-invert max-w-none prose-p:my-0 leading-relaxed transition-colors",
                          textSizeClass,
                          isChecked ? "text-foreground font-medium" : "text-foreground"
                        )}>
                          <RichView html={opt.detail} />
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Bottom Action Footer */}
          <div className="sticky bottom-0 z-20 bg-card border-t border-border p-4 sm:p-5">
            <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">

              <div className="flex w-full sm:w-auto items-center gap-3">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full sm:w-auto"
                  disabled={idx === 0}
                  onClick={() => handleNavigateIdx(idx - 1)}
                >
                  <ChevronLeft className="h-4 w-4" /> Soal sebelumnya
                </Button>

                <label className={cn(
                  "flex h-11 flex-1 cursor-pointer select-none items-center justify-center gap-2 rounded-md border px-4 text-ui font-medium transition-colors sm:flex-none",
                  currentJawaban.ragu
                    ? "border-2 border-warn bg-warn/10 text-warn"
                    : "border-foreground/30 bg-card text-foreground hover:bg-accent"
                )}>
                  <input 
                    type="checkbox" 
                    className="w-5 h-5 rounded cursor-pointer"
                    checked={currentJawaban.ragu}
                    onChange={(e) => updateJawaban({ ragu: e.target.checked })}
                  />
                  <span className="whitespace-nowrap">
                    <span className="sm:hidden">Ragu-ragu</span>
                    <span className="hidden sm:inline">Tandai ragu-ragu</span>
                  </span>
                </label>
              </div>

              {idx < currentSesi.soalIds.length - 1 ? (
                <Button
                  size="lg"
                  className="w-full sm:w-auto"
                  onClick={() => handleNavigateIdx(idx + 1)}
                >
                  Soal berikutnya <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  size="lg"
                  className="w-full sm:w-auto"
                  onClick={() => setShowSubmitDialog(true)}
                >
                  Kumpulkan ujian
                </Button>
              )}

            </div>
          </div>
        </div>

        {/* RIGHT PANEL: GRID NAVIGATION & EMBEDDED CALCULATOR (Desktop Only) */}
        <div className="hidden md:flex flex-col w-80 lg:w-96 bg-muted border-l border-border shrink-0">
          <div className="p-4 sm:p-5 border-b border-border bg-card space-y-3">
            {ujian.allowCalculator ? (
              <div className="flex rounded-lg bg-muted/70 p-1 border border-border">
                <button
                  type="button"
                  onClick={() => setRightTab("navigasi")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-label font-semibold transition-all",
                    rightTab === "navigasi"
                      ? "bg-card text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  aria-selected={rightTab === "navigasi"}
                  role="tab"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  Navigasi soal
                </button>
                <button
                  type="button"
                  onClick={() => setRightTab("kalkulator")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-label font-semibold transition-all",
                    rightTab === "kalkulator"
                      ? "bg-card text-primary dark:text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  aria-selected={rightTab === "kalkulator"}
                  role="tab"
                >
                  <Calculator className="w-3.5 h-3.5" />
                  Kalkulator
                </button>
              </div>
            ) : (
              <h3 className="text-heading font-medium text-foreground">Navigasi soal</h3>
            )}

            {rightTab === "navigasi" ? (
              <>
                <NilaiNormalAction ujian={ujian} />
                <div className="flex flex-col gap-2 pt-1">
                  <div className="flex items-center gap-3 text-ui text-muted-foreground">
                    <div className="h-4 w-4 rounded-sm bg-primary" /> Sudah dijawab
                  </div>
                  <div className="flex items-center gap-3 text-ui text-muted-foreground">
                    <div className="h-4 w-4 rounded-sm bg-warn" /> Ragu-ragu
                  </div>
                  <div className="flex items-center gap-3 text-ui text-muted-foreground">
                    <div className="h-4 w-4 rounded-sm border border-foreground/50 bg-card" /> Belum dijawab
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between text-label font-medium text-muted-foreground pt-0.5">
                <span className="font-medium text-foreground">Kalkulator ilmiah</span>
                <button
                  type="button"
                  onClick={() => setRightTab("navigasi")}
                  className="text-primary hover:underline font-semibold"
                >
                  Lihat navigasi soal →
                </button>
              </div>
            )}
          </div>

          {rightTab === "kalkulator" ? (
            <div className="flex-1 overflow-y-auto p-3 sm:p-4">
              <ExamCalculator />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-5 gap-2.5">
                {currentSesi.soalIds.map((_, i) => {
                  const a = currentSesi.jawaban[i];
                  const dijawab = (a?.jawabanIds?.length ?? 0) > 0 || (a?.jawabanEssay ? a.jawabanEssay.length > 0 : false);

                  return (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Buka soal nomor ${i + 1}${a.ragu ? ", ragu-ragu" : dijawab ? ", sudah dijawab" : ", belum dijawab"}`}
                      aria-current={i === idx ? "step" : undefined}
                      title={`Buka soal nomor ${i + 1}`}
                      onClick={() => handleNavigateIdx(i)}
                      className={cn(
                        "relative flex aspect-square items-center justify-center rounded-md border text-ui font-medium tabular-nums transition-colors",
                        i === idx && "ring-2 ring-foreground ring-offset-2 ring-offset-muted",
                        a.ragu
                          ? "border-warn bg-warn text-background"
                          : dijawab
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-foreground/50 bg-card text-foreground hover:bg-accent"
                      )}
                    >
                      {i + 1}
                      {a.ragu && (
                        <span aria-hidden="true" className="absolute right-1 top-0 text-label font-semibold">?</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="p-6 border-t border-border bg-card">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowSubmitDialog(true)}
            >
              Kumpulkan ujian
            </Button>
          </div>
        </div>

      </div>

      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent className="w-[calc(100%_-_2rem)] max-w-md">
          <div>
            <DialogHeader>
              <DialogTitle className="text-heading">Kumpulkan ujian sekarang?</DialogTitle>
              <DialogDescription className="pt-2 leading-relaxed">
                Pastikan semua jawaban telah terisi dengan benar. Setelah dikumpulkan, jawaban tidak dapat diubah kembali.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-6 gap-2 sm:space-x-0">
              <DialogClose asChild>
                <Button variant="outline">Periksa kembali</Button>
              </DialogClose>
              <Button
                variant="destructive"
                onClick={() => {
                  setShowSubmitDialog(false);
                  void submit();
                }}
              >
                Ya, kumpulkan
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* MOBILE LIST MODAL (Show when showList is true) */}
      {showList && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          <div className="flex items-center justify-between border-b bg-card px-6 py-4">
            <div className="flex items-center gap-3 text-lg font-semibold text-foreground">
              <LayoutGrid className="h-5 w-5" aria-hidden="true" /> Daftar soal
            </div>
            <button
              type="button"
              aria-label="Tutup daftar soal"
              title="Tutup daftar soal"
              className="inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              onClick={() => setShowList(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-xl mx-auto">
              {ujian.allowCalculator && (
                <div className="flex rounded-lg bg-muted/70 p-1 mb-5 border border-border">
                  <button
                    type="button"
                    onClick={() => setMobileTab("navigasi")}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-label font-semibold transition-all",
                      mobileTab === "navigasi"
                        ? "bg-card text-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    Daftar Soal
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileTab("kalkulator")}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-label font-semibold transition-all",
                      mobileTab === "kalkulator"
                        ? "bg-card text-primary dark:text-primary-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    <Calculator className="w-3.5 h-3.5" />
                    Kalkulator
                  </button>
                </div>
              )}

              {mobileTab === "kalkulator" ? (
                <div className="py-2">
                  <ExamCalculator />
                </div>
              ) : (
                <>
                  <NilaiNormalAction ujian={ujian} />

                  <div className="flex justify-between items-center bg-card p-4 rounded-lg border border-border mb-8 mt-4">
                    <div className="flex flex-col items-center">
                      <div className="mb-1 h-4 w-4 rounded-sm bg-primary" />
                      <span className="text-label text-muted-foreground">Sudah</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="mb-1 h-4 w-4 rounded-sm bg-warn" />
                      <span className="text-label text-muted-foreground">Ragu</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="mb-1 h-4 w-4 rounded-sm border border-foreground/50 bg-card" />
                      <span className="text-label text-muted-foreground">Kosong</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-5 sm:grid-cols-6 gap-3">
                    {currentSesi.soalIds.map((_, i) => {
                      const a = currentSesi.jawaban[i];
                      const dijawab = (a?.jawabanIds?.length ?? 0) > 0 || (a?.jawabanEssay ? a.jawabanEssay.length > 0 : false);
                      return (
                        <button
                          key={i}
                          type="button"
                          aria-label={`Buka soal nomor ${i + 1}`}
                          title={`Buka soal nomor ${i + 1}`}
                          onClick={() => { handleNavigateIdx(i); setShowList(false); }}
                          className={cn(
                            "relative aspect-square rounded-md border text-heading font-medium tabular-nums transition-colors",
                            i === idx && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
                            a.ragu
                              ? "border-warn bg-warn text-background"
                              : dijawab
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-foreground/50 bg-card text-foreground"
                          )}
                        >
                          {i + 1}
                          {a.ragu && (
                            <span aria-hidden="true" className="absolute right-1.5 top-0.5 text-label font-semibold">?</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              <div className="mt-12 pb-12">
                <Button 
                  size="lg"
                  className="w-full"
                  variant="outline"
                  onClick={() => {
                    setShowList(false);
                    setShowSubmitDialog(true);
                  }}
                >
                  Kumpulkan ujian
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
