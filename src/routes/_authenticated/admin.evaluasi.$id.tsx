import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { sesiRepo, ujianRepo, soalRepo, usersRepo, hydrateRepos } from "@/lib/cbt/repos";
import { useAuthStore } from "@/lib/cbt/auth-store";
import { recomputeSkor } from "@/lib/cbt/exam";
import { RichView } from "@/components/cbt/RichEditor";
import { toast } from "sonner";
import { CheckCircle2, AlertTriangle } from "lucide-react";

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
  
  if (!me) return <div className="py-20 text-center text-sm text-slate-500">Akses Ditolak</div>;
  if (!sesi) return <div className="py-20 text-center text-sm text-slate-500">Sesi tidak ditemukan</div>;
  
  const ujian = ujianRepo.byId(sesi.ujianId);
  if (!ujian) return <div className="py-20 text-center text-sm text-slate-500">Ujian tidak ditemukan</div>;
  
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
    toast.success(`Tersimpan. Nilai Akhir: ${withMeta.skorTotal} / ${withMeta.maxSkor}`);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12 pb-32">
      <div className="mb-12">
        <Link 
          to="/admin/evaluasi" 
          className="text-sm font-medium text-slate-500 hover:text-slate-900 dark:hover:text-zinc-100 transition-colors mb-6 inline-block"
        >
          ← Back to Inbox
        </Link>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-zinc-100 tracking-tight">
          {peserta?.namaLengkap || "Anonim"}
        </h1>
        <p className="text-sm text-slate-500 dark:text-zinc-400 mt-2">
          {ujian.nama} • {items.length} essays
        </p>
      </div>

      <div className="space-y-12">
        {items.map(({ j, idx, soal }) => {
          const isGraded = typeof j.skor === 'number';
          
          if (!soal) return (
            <div key={idx} className="flex items-center gap-2 text-rose-500 text-sm">
              <AlertTriangle className="h-4 w-4" /> Soal #{idx + 1} tidak ditemukan.
            </div>
          );

          return (
            <div key={idx} className="pb-12 border-b border-slate-200 dark:border-zinc-800 last:border-0">
              <div className="flex items-center justify-between mb-6">
                <span className="text-sm font-medium text-slate-400 dark:text-zinc-500">
                  Question {idx + 1}
                </span>
                {isGraded ? (
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-500 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Graded
                  </span>
                ) : (
                  <span className="text-xs font-medium text-amber-600 dark:text-amber-500 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span> Pending
                  </span>
                )}
              </div>
              
              <div className="prose prose-sm dark:prose-invert max-w-none text-slate-900 dark:text-zinc-100 mb-8">
                <RichView html={soal.detail} />
              </div>
              
              <div className="pl-4 border-l-2 border-indigo-100 dark:border-indigo-900/30 mb-8">
                <span className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2 block">
                  Student's Answer
                </span>
                <div className="text-base text-slate-800 dark:text-zinc-200 whitespace-pre-wrap font-serif leading-relaxed">
                  {j.jawabanEssay ? j.jawabanEssay : <span className="text-slate-400 italic">No answer provided.</span>}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center bg-slate-50/50 dark:bg-zinc-900/20 p-4 rounded-md">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-500">Score</span>
                  <input
                    type="number"
                    min={0}
                    max={ujian.poinBenar}
                    value={j.skor ?? ""}
                    onChange={(e) => setSkor(idx, e.target.value === "" ? undefined : Number(e.target.value), j.catatanGrader ?? "")}
                    placeholder="0"
                    className="w-16 h-8 bg-transparent border-b border-slate-300 dark:border-zinc-700 text-base font-semibold text-slate-900 dark:text-zinc-100 text-center focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                  <span className="text-sm text-slate-500">/ {ujian.poinBenar} pts</span>
                </div>
                
                <div className="hidden sm:block w-px h-6 bg-slate-200 dark:bg-zinc-800"></div>

                <div className="flex-1 w-full flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-500">Note</span>
                  <input
                    type="text"
                    value={j.catatanGrader ?? ""}
                    onChange={(e) => setSkor(idx, j.skor, e.target.value)}
                    placeholder="Feedback (optional)..."
                    className="flex-1 w-full h-8 bg-transparent border-b border-slate-300 dark:border-zinc-700 text-sm text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="fixed bottom-6 left-0 right-0 pointer-events-none flex justify-center z-50">
        <div className="pointer-events-auto flex items-center gap-6 bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-6 py-3 rounded-full shadow-2xl border border-white/10 dark:border-black/10">
          <div className="text-sm font-medium">
            {totalUngraded === 0 ? "All graded" : `${totalUngraded} remaining`}
          </div>
          <div className="w-px h-4 bg-slate-700 dark:bg-zinc-300"></div>
          <div className="text-sm">
            Total: <span className="font-bold">{sesi.skorTotal ?? 0}</span> <span className="text-slate-400 dark:text-zinc-500">/ {sesi.maxSkor ?? 0}</span>
          </div>
          <button 
            onClick={selesaikan}
            className="ml-2 text-sm font-bold bg-indigo-500 dark:bg-indigo-600 text-white px-5 py-2 rounded-full hover:bg-indigo-400 dark:hover:bg-indigo-500 transition-colors"
          >
            Submit Grades
          </button>
        </div>
      </div>
    </div>
  );
}
