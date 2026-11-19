import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { sesiRepo, ujianRepo, soalRepo, usersRepo, hydrateRepos } from "@/lib/cbt/repos";
import { useAuthStore } from "@/lib/cbt/auth-store";
import { recomputeSkor } from "@/lib/cbt/scoring";
import { RichView } from "@/components/cbt/RichEditor";
import { toast } from "sonner";
import { CheckCircle2, AlertTriangle, Save } from "lucide-react";


export const Route = createFileRoute("/_authenticated/admin/evaluasi/$id")({
  loader: async () => {
    try {
      await hydrateRepos();
    } catch {
      // Fallback

    }
  },
  component: EvaluasiSesi,
});

function EvaluasiSesi() {
  const { id } = useParams({ from: "/_authenticated/admin/evaluasi/$id" });
  const me = useAuthStore((s) => s.user);
  const [sesi, setSesi] = useState(sesiRepo.byId(id));
  const [isSaving, setIsSaving] = useState(false);
  
  if (!me) return <div className="py-20 text-center text-sm font-semibold text-muted-foreground">Akses Ditolak</div>;
  if (!sesi) return <div className="py-20 text-center text-sm font-semibold text-muted-foreground">Sesi tidak ditemukan</div>;
  
  const ujian = ujianRepo.byId(sesi.ujianId);
  if (!ujian) return <div className="py-20 text-center text-sm font-semibold text-muted-foreground">Ujian tidak ditemukan</div>;
  
  const peserta = usersRepo.byId(sesi.pesertaId);

  const items = sesi.jawaban
    .map((j, idx) => ({ j, idx, soal: soalRepo.byId(j.soalId) }))
    .filter((x) => x.soal?.tipe === "essay");

  const totalUngraded = items.filter(x => typeof x.j.skor !== 'number').length;

  function normalizeSkor(skor: number | undefined): number | undefined {
    if (skor === undefined || !Number.isFinite(skor)) return undefined;
    return Math.max(0, Math.min(ujian!.poinBenar, skor));
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

  async function fillZeroForEmpty() {
    if (!sesi) return;
    let changed = false;
    const nextJawaban = sesi.jawaban.map((j) => {
      const soal = soalRepo.byId(j.soalId);
      if (soal?.tipe === "essay" && typeof j.skor !== "number") {
        if (!j.jawabanEssay || j.jawabanEssay.trim().length === 0) {
          changed = true;
          return { ...j, skor: 0, catatanGrader: "Tidak menjawab" };
        }
      }
      return j;
    });
    if (changed) {
      const next = { ...sesi, jawaban: nextJawaban };
      sesiRepo.upsert(next);
      setSesi(next);
      try {
        await sesiRepo.flush();
        toast.success("Berhasil memberi nilai 0 pada jawaban kosong.");
      } catch {
        toast.error("Gagal menyimpan nilai 0.");
      }
    } else {
      toast.info("Tidak ada jawaban kosong yang belum dinilai.");
    }
  }

  async function selesaikan() {
    if (!sesi) return;
    setIsSaving(true);
    try {
      const final = recomputeSkor(sesi, ujian!);
      const withMeta = { ...final, gradedAt: Date.now(), gradedBy: me!.id };
      sesiRepo.upsert(withMeta);
      setSesi(withMeta);
      await sesiRepo.flush();
      toast.success(`Berhasil disimpan. Nilai Akhir: ${withMeta.skorTotal} / ${withMeta.maxSkor}`);
    } catch (e) {
      toast.error("Gagal menyimpan nilai");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-32">
      <div className="mb-6 bg-card p-6 sm:p-8 rounded-lg border border-border">
        <Link 
          to="/admin/evaluasi" 
          className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors mb-6 inline-flex items-center gap-1"
        >
          ← Kembali
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mt-2">
          <div>
            <h1 className="text-3xl font-semibold text-foreground tracking-tight">
              {peserta?.namaLengkap || "Peserta Anonim"}
            </h1>
            <p className="text-sm font-medium text-muted-foreground mt-2">
              {ujian.nama} • <span className="font-semibold text-foreground">{items.length}</span> essay untuk dinilai
            </p>
          </div>
          
          <button 
            onClick={fillZeroForEmpty} 
            className="inline-flex items-center gap-1.5 text-label font-semibold bg-muted hover:bg-accent text-foreground px-4 py-2 rounded-lg transition-colors border border-border self-start sm:self-auto"
          >
            <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
            Beri 0 untuk yang Kosong
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {items.map(({ j, idx, soal }) => {
          const isGraded = typeof j.skor === 'number';
          
          if (!soal) return (
            <div key={idx} className="flex items-center gap-2 text-destructive text-sm font-semibold p-4 bg-destructive/10 rounded-lg">
              <AlertTriangle className="h-4 w-4" /> Soal #{idx + 1} tidak ditemukan.
            </div>
          );

          return (
            <div key={idx} className="bg-card border border-border rounded-lg overflow-hidden">
              
              {/* Question Header */}
              <div className="flex items-center justify-between px-6 py-4 bg-muted/50 border-b border-border">
                <span className="text-label font-semibold text-muted-foreground">
                  Pertanyaan {idx + 1}
                </span>
                {isGraded ? (
                  <span className="text-label font-semibold text-primary flex items-center gap-1.5 bg-primary/10 px-2 py-1 rounded-md border border-primary/20">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Dinilai
                  </span>
                ) : (
                  <span className="text-label font-semibold text-warn flex items-center gap-1.5 bg-warn/10 px-2.5 py-1 rounded-md border border-warn/30">
                    Belum
                  </span>
                )}
              </div>
              
              <div className="p-6">
                {/* Question Content */}
                <div className="mb-6 p-6 bg-primary/5 dark:bg-primary/10 rounded-lg border border-primary/10 dark:border-primary/20">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    <span className="text-label font-semibold text-primary">
                      Pertanyaan Soal
                    </span>
                  </div>
                  <div className="prose prose-lg prose-slate dark:prose-invert max-w-none text-foreground font-medium leading-relaxed">
                    <RichView html={soal.detail} />
                  </div>
                </div>
                
                {/* Student Answer */}
                <div className="p-5 bg-muted rounded-lg border border-border mb-6">
                  <span className="text-label font-semibold text-muted-foreground mb-3 block">
                    Jawaban Peserta
                  </span>
                  <div className="text-[15px] text-foreground whitespace-pre-wrap font-serif leading-relaxed">
                    {j.jawabanEssay ? j.jawabanEssay : <span className="text-muted-foreground">Tidak ada jawaban yang dikirimkan.</span>}
                  </div>
                </div>

                {/* Grading Controls */}
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center bg-muted border border-border p-4 rounded-lg">
                  
                  {/* Score Input */}
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-label font-semibold text-muted-foreground">Nilai</span>
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        max={ujian.poinBenar}
                        value={j.skor ?? ""}
                        onChange={(e) => setSkor(idx, e.target.value === "" ? undefined : Number(e.target.value), j.catatanGrader ?? "")}
                        placeholder="0"
                        className="w-20 h-10 bg-card border border-border rounded-lg text-sm font-semibold text-foreground text-center pr-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                      />
                    </div>
                    <span className="text-sm font-semibold text-muted-foreground">/ {ujian.poinBenar}</span>
                  </div>
                  
                  <div className="hidden sm:block w-px h-8 bg-muted mx-2"></div>

                  {/* Note Input */}
                  <div className="flex-1 w-full flex flex-col sm:flex-row sm:items-center gap-3">
                    <span className="text-label font-semibold text-muted-foreground">Catatan</span>
                    <input
                      type="text"
                      value={j.catatanGrader ?? ""}
                      onChange={(e) => setSkor(idx, j.skor, e.target.value)}
                      placeholder="Tambahkan evaluasi (opsional)..."
                      className="flex-1 w-full h-10 bg-card border border-border rounded-lg text-sm text-foreground px-4 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    />
                  </div>

                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating Bottom Bar (Tactile & Springy) */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <div className="flex items-center gap-5 sm:gap-8 bg-foreground text-background px-6 sm:px-8 py-3.5 rounded-md border border-white/10">
          
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
            <div className="text-label font-semibold text-background/70">
              {totalUngraded === 0 ? "Selesai Dinilai" : `${totalUngraded} Belum Dinilai`}
            </div>
            <div className="hidden sm:block w-1.5 h-1.5 rounded-full bg-background/50"></div>
            <div className="text-sm">
              <span className="text-background/70">Total:</span> <span className="font-semibold text-lg leading-none">{sesi.skorTotal ?? 0}</span> <span className="text-background/70 font-medium">/ {sesi.maxSkor ?? 0}</span>
            </div>
          </div>
          
          <button 
            onClick={selesaikan}
            disabled={isSaving}
            className="flex items-center gap-2 text-sm font-semibold bg-foreground text-background px-5 sm:px-6 py-2.5 rounded-md hover:opacity-90 transition-all disabled:opacity-50"
          >
            {isSaving ? (
              <span className="flex items-center gap-2"><div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Menyimpan...</span>
            ) : (
              <span className="flex items-center gap-2"><Save className="h-4 w-4" /> Simpan Nilai</span>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
