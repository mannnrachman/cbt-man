import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { sesiRepo, ujianRepo, soalRepo, usersRepo, hydrateRepos } from "@/lib/cbt/repos";
import { useAuthStore } from "@/lib/cbt/auth-store";
import { recomputeSkor } from "@/lib/cbt/exam";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RichView } from "@/components/cbt/RichEditor";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/evaluasi/$id")({
  loader: async () => {
    try {
      await hydrateRepos();
    } catch {
      // Fallback ke cache; jangan brick navigasi saat snapshot gagal.
    }
  },
  component: EvaluasiSesi,
});

function EvaluasiSesi() {
  const { id } = useParams({ from: "/_authenticated/admin/evaluasi/$id" });
  const me = useAuthStore((s) => s.user);
  const [sesi, setSesi] = useState(sesiRepo.byId(id));
  if (!me) return <div>Anda harus login terlebih dahulu</div>;
  if (!sesi) return <div>Sesi tidak ditemukan</div>;
  const ujian = ujianRepo.byId(sesi.ujianId);
  if (!ujian) return <div>Ujian untuk sesi ini tidak ditemukan</div>;
  const peserta = usersRepo.byId(sesi.pesertaId);

  const currentUjian = ujian;
  const currentMe = me;
  const items = sesi.jawaban
    .map((j, idx) => ({ j, idx, soal: soalRepo.byId(j.soalId) }))
    .filter((x) => x.soal?.tipe === "essay" || x.j.jawabanEssay.trim().length > 0);

  function normalizeSkor(skor: number | undefined): number | undefined {
    if (skor === undefined) return undefined;
    if (!Number.isFinite(skor)) return undefined;
    return Math.max(0, Math.min(currentUjian.poinBenar, skor));
  }

  function setSkor(idx: number, skor: number | undefined, catatan: string) {
    if (!sesi) return;
    const next = {
      ...sesi,
      jawaban: sesi.jawaban.map((x, i) =>
        i === idx ? { ...x, skor: normalizeSkor(skor), catatanGrader: catatan } : x,
      ),
    };
    sesiRepo.upsert(next);
    setSesi(next);
  }

  function selesaikan() {
    if (!sesi) return;
    const final = recomputeSkor(sesi, currentUjian);
    const withMeta = { ...final, gradedAt: Date.now(), gradedBy: currentMe.id };
    sesiRepo.upsert(withMeta);
    setSesi(withMeta);
    toast.success(`Nilai akhir: ${withMeta.skorTotal} / ${withMeta.maxSkor}`);
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <Link to="/admin/evaluasi" className="text-sm text-muted-foreground hover:underline">
          ← Daftar evaluasi
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          Nilai Essay — {peserta?.namaLengkap}
        </h1>
        <p className="text-sm text-muted-foreground">
          Ujian: {currentUjian.nama} · Poin per soal: {currentUjian.poinBenar}
        </p>
      </div>

      {items.map(({ j, idx, soal }) => {
        if (!soal) {
          return (
            <Card key={idx}>
              <CardContent className="space-y-3 p-4 text-sm text-muted-foreground">
                <div className="text-xs">Soal essay #{idx + 1}</div>
                <div>Soal untuk jawaban ini tidak ditemukan lagi di bank soal.</div>
                <div className="rounded bg-muted p-3 whitespace-pre-wrap">
                  {j.jawabanEssay || <em>(kosong)</em>}
                </div>
              </CardContent>
            </Card>
          );
        }
        return (
          <Card key={idx}>
            <CardContent className="space-y-3 p-4">
              <div className="text-xs text-muted-foreground">Soal #{idx + 1}</div>
              <RichView html={soal.detail} />
              <div className="rounded bg-muted p-3 text-sm whitespace-pre-wrap">
                {j.jawabanEssay || <em className="text-muted-foreground">(kosong)</em>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Skor (0–{currentUjian.poinBenar})</Label>
                  <Input
                    type="number"
                    min={0}
                    max={currentUjian.poinBenar}
                    value={j.skor ?? ""}
                    onChange={(e) => {
                      const v = e.target.value === "" ? undefined : Number(e.target.value);
                      setSkor(idx, v, j.catatanGrader ?? "");
                    }}
                  />
                </div>
                <div>
                  <Label>Catatan untuk peserta</Label>
                  <Textarea
                    rows={2}
                    value={j.catatanGrader ?? ""}
                    onChange={(e) => setSkor(idx, j.skor, e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <div className="flex items-center justify-between rounded border bg-muted/30 p-3">
        <div className="text-sm">
          Skor saat ini:{" "}
          <strong>
            {sesi.skorTotal ?? "-"} / {sesi.maxSkor ?? "-"}
          </strong>
          {sesi.gradedAt && (
            <span className="ml-2 text-xs text-muted-foreground">
              terakhir dinilai {new Date(sesi.gradedAt).toLocaleString("id-ID")}
            </span>
          )}
        </div>
        <Button onClick={selesaikan}>Simpan & Hitung Ulang Skor</Button>
      </div>
    </div>
  );
}
