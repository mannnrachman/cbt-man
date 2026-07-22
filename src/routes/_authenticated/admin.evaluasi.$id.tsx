import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { sesiRepo, ujianRepo, soalRepo, usersRepo, hydrateRepos } from "@/lib/cbt/repos";
import { useAuthStore } from "@/lib/cbt/auth-store";
import { recomputeSkor } from "@/lib/cbt/exam";
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
  
  if (!me) return <div className="py-20 text-center text-sm font-bold text-slate-500">Akses Ditolak</div>;
  if (!sesi) return <div className="py-20 text-center text-sm font-bold text-slate-500">Sesi tidak ditemukan</div>;
  
  const ujian = ujianRepo.byId(sesi.ujianId);
  if (!ujian) return <div className="py-20 text-center text-sm font-bold text-slate-500">Ujian tidak ditemukan</div>;
  
  const peserta = usersRepo.byId(sesi.pesertaId);
  const items = sesi.jawaban
    .map((j, idx) => ({ j, idx, soal: soalRepo.byId(j.soalId) }))
    .filter((x) => x.soal?.tipe === "essay" || x.j.jawabanEssay.trim().length > 0);

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

  function selesaikan() {
    if (!sesi) return;
    const final = recomputeSkor(sesi, ujian!);
    const withMeta = { ...final, gradedAt: Date.now(), gradedBy: me!.id };
    sesiRepo.upsert(withMeta);
    setSesi(withMeta);
    toast.success(`Berhasil disimpan. Nilai Akhir: ${withMeta.skorTotal} / ${withMeta.maxSkor}`);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-32">
      <div className="mb-6 bg-white dark:bg-slate-950 p-6 sm:p-8 rounded-[22px] border border-slate-200 dark:border-slate-800 shadow-sleek">
        <Link 
          to="/admin/evaluasi" 
          className="text-sm font-bold text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors mb-6 inline-flex items-center gap-1"
        >
          ← Kembali
        </Link>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          {peserta?.namaLengkap || "Peserta Anonim"}
        </h1>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2">
          {ujian.nama} • <span className="font-bold text-slate-700 dark:text-slate-300">{items.length}</span> essay untuk dinilai
        </p>
      </div>

      <div className="space-y-6">
        {items.map(({ j, idx, soal }) => {
          const isGraded = typeof j.skor === 'number';
          
          if (!soal) return (
            <div key={idx} className="flex items-center gap-2 text-rose-500 text-sm font-bold p-4 bg-rose-50 dark:bg-rose-950/30 rounded-xl">
              <AlertTriangle className="h-4 w-4" /> Soal #{idx + 1} tidak ditemukan.
            </div>
          );

          return (
            <div key={idx} className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              
              {/* Question Header */}
              <div className="flex items-center justify-between px-6 py-4 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Pertanyaan {idx + 1}
                </span>
                {isGraded ? (
                  <span className="text-[11px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5 bg-primary/10 px-2 py-1 rounded-md border border-primary/20">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Dinilai
                  </span>
                ) : (
                  <span className="text-[11px] font-bold uppercase tracking-wider text-accent flex items-center gap-1.5 bg-accent/10 px-2 py-1 rounded-md border border-accent/20">
                    Belum
                  </span>
                )}
              </div>
              
              <div className="p-6">
                {/* Question Content */}
                <div className="mb-6 p-6 bg-primary/5 dark:bg-primary/10 rounded-2xl border border-primary/10 dark:border-primary/20">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    <span className="text-[11px] font-bold text-primary uppercase tracking-wider">
                      Pertanyaan Soal
                    </span>
                  </div>
                  <div className="prose prose-lg prose-slate dark:prose-invert max-w-none text-slate-900 dark:text-slate-100 font-medium leading-relaxed">
                    <RichView html={soal.detail} />
                  </div>
                </div>
                
                {/* Student Answer */}
                <div className="p-5 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200/50 dark:border-slate-800/50 mb-6">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3 block">
                    Jawaban Peserta
                  </span>
                  <div className="text-[15px] text-slate-800 dark:text-slate-200 whitespace-pre-wrap font-serif leading-relaxed">
                    {j.jawabanEssay ? j.jawabanEssay : <span className="text-slate-400 italic">Tidak ada jawaban yang dikirimkan.</span>}
                  </div>
                </div>

                {/* Grading Controls */}
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-inner">
                  
                  {/* Score Input */}
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Nilai</span>
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        max={ujian.poinBenar}
                        value={j.skor ?? ""}
                        onChange={(e) => setSkor(idx, e.target.value === "" ? undefined : Number(e.target.value), j.catatanGrader ?? "")}
                        placeholder="0"
                        className="w-20 h-10 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-900 dark:text-slate-100 text-center pr-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                      />
                    </div>
                    <span className="text-sm font-bold text-slate-500">/ {ujian.poinBenar}</span>
                  </div>
                  
                  <div className="hidden sm:block w-px h-8 bg-slate-200 dark:bg-slate-800 mx-2"></div>

                  {/* Note Input */}
                  <div className="flex-1 w-full flex flex-col sm:flex-row sm:items-center gap-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Catatan</span>
                    <input
                      type="text"
                      value={j.catatanGrader ?? ""}
                      onChange={(e) => setSkor(idx, j.skor, e.target.value)}
                      placeholder="Tambahkan evaluasi (opsional)..."
                      className="flex-1 w-full h-10 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 px-4 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                    />
                  </div>

                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating Bottom Bar (Tactile & Springy) */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 shadow-2xl">
        <div className="flex items-center gap-5 sm:gap-8 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 sm:px-8 py-3.5 rounded-full shadow-popover-sleek border border-white/10 dark:border-black/5 backdrop-blur-lg">
          
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
            <div className="text-[11px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500">
              {totalUngraded === 0 ? "Selesai Dinilai" : `${totalUngraded} Belum Dinilai`}
            </div>
            <div className="hidden sm:block w-1.5 h-1.5 rounded-full bg-slate-700 dark:bg-slate-300"></div>
            <div className="text-sm">
              <span className="text-slate-400 dark:text-slate-500">Total:</span> <span className="font-bold text-lg leading-none">{sesi.skorTotal ?? 0}</span> <span className="text-slate-400 dark:text-slate-500 font-medium">/ {sesi.maxSkor ?? 0}</span>
            </div>
          </div>
          
          <button 
            onClick={selesaikan}
            className="flex items-center gap-2 text-sm font-bold bg-primary text-primary-foreground px-5 sm:px-6 py-2.5 rounded-full hover:opacity-90 active:scale-95 shadow-md transition-all"
          >
            <Save className="h-4 w-4" />
            Simpan Nilai
          </button>
        </div>
      </div>
    </div>
  );
}
