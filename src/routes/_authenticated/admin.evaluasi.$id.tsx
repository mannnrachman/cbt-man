import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { sesiRepo, ujianRepo, soalRepo, usersRepo, hydrateRepos } from "@/lib/cbt/repos";
import { useAuthStore } from "@/lib/cbt/auth-store";
import { recomputeSkor } from "@/lib/cbt/exam";
import { RichView } from "@/components/cbt/RichEditor";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, AlertCircle, Save, FileSignature, AlertTriangle } from "lucide-react";

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
  
  if (!me) return <div className="p-8 text-center font-bold text-slate-500">Akses Ditolak</div>;
  if (!sesi) return <div className="p-8 text-center font-bold text-slate-500">Sesi tidak ditemukan</div>;
  
  const ujian = ujianRepo.byId(sesi.ujianId);
  if (!ujian) return <div className="p-8 text-center font-bold text-slate-500">Ujian tidak ditemukan</div>;
  
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
    // ponytail: recompute on save without waiting for effect
    const final = recomputeSkor(sesi, ujian!);
    const withMeta = { ...final, gradedAt: Date.now(), gradedBy: me!.id };
    sesiRepo.upsert(withMeta);
    setSesi(withMeta);
    toast.success(`Tersimpan. Nilai: ${withMeta.skorTotal} / ${withMeta.maxSkor}`);
  }

  return (
    <div className="relative min-h-screen pb-32">
      {/* Studio-Tier Glow Background */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-indigo-50/60 via-white to-white dark:from-indigo-950/20 dark:via-zinc-950 dark:to-zinc-950 -z-10" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8 space-y-10">
        
        {/* Nav & Header */}
        <div className="space-y-6">
          <Link 
            to="/admin/evaluasi" 
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-900 dark:hover:text-zinc-100 transition-colors ease-[cubic-bezier(0.16,1,0.3,1)] duration-300 active:scale-95 origin-left"
          >
            <ArrowLeft className="h-4 w-4" /> Kembali
          </Link>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100/50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 text-xs font-bold uppercase tracking-widest border border-indigo-200/50 dark:border-indigo-500/20">
                Koreksi Manual
              </div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-slate-900 dark:text-zinc-50 leading-none">
                Evaluasi Essay
              </h1>
              <p className="text-base text-slate-500 dark:text-zinc-400 font-medium max-w-2xl leading-relaxed">
                Pemeriksaan jawaban untuk <strong className="text-slate-700 dark:text-zinc-300">{peserta?.namaLengkap || "Anonim"}</strong> pada ujian <strong className="text-slate-700 dark:text-zinc-300">{ujian.nama}</strong>.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-10 items-start">
          
          {/* Main List */}
          <div className="flex-1 space-y-8 w-full">
            {items.map(({ j, idx, soal }) => {
              const isGraded = typeof j.skor === 'number';
              
              // ponytail: graceful bailout for missing data instead of defensive wrappers
              if (!soal) return (
                <div key={idx} className="bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 p-6 rounded-3xl">
                  <AlertTriangle className="h-6 w-6 text-rose-500 mb-2" />
                  <p className="font-bold text-rose-700 dark:text-rose-400">Soal #{idx + 1} tidak ditemukan (dihapus).</p>
                </div>
              );

              return (
                <div 
                  key={idx} 
                  className={`group relative overflow-hidden rounded-3xl border transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.01] ${
                    isGraded 
                      ? 'bg-white/60 dark:bg-zinc-900/40 border-slate-200/80 dark:border-zinc-800/60 backdrop-blur-xl' 
                      : 'bg-white dark:bg-zinc-900 border-amber-200/80 dark:border-amber-900/60 shadow-lg shadow-amber-900/5'
                  }`}
                >
                  <div className="p-6 md:p-8 space-y-8">
                    {/* Header Soal */}
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-zinc-800 font-mono text-sm font-black text-slate-700 dark:text-zinc-300 transition-colors">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">
                          Pertanyaan
                        </span>
                      </div>
                      {isGraded ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100/50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider border border-emerald-200/50 dark:border-emerald-500/20 transition-all">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Dinilai
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100/50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-500 text-xs font-bold uppercase tracking-wider border border-amber-200/50 dark:border-amber-500/20 animate-pulse">
                          <AlertCircle className="h-3.5 w-3.5" /> Menunggu
                        </span>
                      )}
                    </div>

                    {/* Konten Soal */}
                    <div className="prose prose-slate dark:prose-invert prose-p:leading-relaxed max-w-none text-slate-800 dark:text-zinc-200">
                      <RichView html={soal.detail} />
                    </div>

                    {/* Jawaban Peserta */}
                    <div className="space-y-3">
                      <div className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                        <FileSignature className="h-4 w-4" /> Jawaban Peserta
                      </div>
                      <div className="text-base text-slate-900 dark:text-zinc-100 bg-slate-50 dark:bg-zinc-950/50 p-5 rounded-2xl border border-slate-100 dark:border-zinc-800/50 whitespace-pre-wrap min-h-[120px] leading-relaxed transition-colors group-hover:bg-slate-100/50 dark:group-hover:bg-zinc-900/50">
                        {j.jawabanEssay ? j.jawabanEssay : <span className="text-slate-400 italic">Peserta tidak mengisi kolom jawaban.</span>}
                      </div>
                    </div>
                  </div>

                  {/* Form Nilai (Native HTML with Design Eng Polishing) */}
                  <div className={`p-6 md:px-8 border-t transition-colors duration-500 ${isGraded ? 'border-slate-100 dark:border-zinc-800/80 bg-slate-50/50 dark:bg-zinc-950/30' : 'border-amber-100 dark:border-amber-900/30 bg-amber-50/30 dark:bg-amber-950/10'}`}>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="space-y-2">
                          <label className="text-xs font-black uppercase tracking-widest text-slate-500 block">Poin Nilai</label>
                          <input
                            type="number"
                            min={0}
                            max={ujian.poinBenar}
                            value={j.skor ?? ""}
                            onChange={(e) => setSkor(idx, e.target.value === "" ? undefined : Number(e.target.value), j.catatanGrader ?? "")}
                            placeholder="0"
                            className="w-24 h-12 text-center text-xl font-black bg-white dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-700 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-slate-300 active:scale-95"
                          />
                        </div>
                        <div className="text-sm font-bold text-slate-400 dark:text-zinc-500 pt-7">
                          / {ujian.poinBenar} pts
                        </div>
                      </div>

                      <div className="flex-1 w-full space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-slate-500 block">Catatan Pemeriksa</label>
                        <input
                          type="text"
                          value={j.catatanGrader ?? ""}
                          onChange={(e) => setSkor(idx, j.skor, e.target.value)}
                          placeholder="Feedback (Opsional)..."
                          className="w-full h-12 px-4 font-medium bg-white dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-700 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-slate-300 active:scale-[0.99]"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {items.length === 0 && (
              <div className="py-24 text-center rounded-3xl border border-dashed border-slate-300 dark:border-zinc-800 bg-white/30 dark:bg-zinc-900/30 backdrop-blur-sm">
                <p className="font-bold text-slate-500 dark:text-zinc-400">Tidak ada soal essay untuk dievaluasi.</p>
              </div>
            )}
          </div>

          {/* Sticky Sidebar */}
          <div className="w-full lg:w-96 shrink-0 sticky top-8">
            <div className="bg-white/80 dark:bg-zinc-900/60 backdrop-blur-xl rounded-3xl border border-slate-200/80 dark:border-zinc-800/80 shadow-xl shadow-slate-900/5 overflow-hidden flex flex-col transform-gpu">
              {/* Progress Line Header */}
              <div className="h-2 w-full bg-slate-100 dark:bg-zinc-800">
                <div 
                  className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)]" 
                  style={{ width: `${items.length > 0 ? ((items.length - totalUngraded) / items.length) * 100 : 0}%` }}
                />
              </div>

              <div className="p-6 md:p-8 space-y-8">
                <div>
                  <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-zinc-100">Ringkasan Evaluasi</h2>
                  <p className="text-sm font-medium text-slate-500 dark:text-zinc-400 mt-1">Status koreksi & nilai akhir</p>
                </div>

                <div className="space-y-5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black uppercase tracking-widest text-slate-500">Progress</span>
                    {totalUngraded > 0 ? (
                      <span className="text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-500/10 px-2 py-1 rounded-md border border-amber-200/50 dark:border-amber-500/20">
                        Sisa {totalUngraded} Soal
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-200/50 dark:border-emerald-500/20">
                        Selesai 100%
                      </span>
                    )}
                  </div>

                  <div className="bg-slate-50/50 dark:bg-zinc-950/30 rounded-2xl p-6 border border-slate-100 dark:border-zinc-800 text-center transition-colors">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-2">Skor Sementara</div>
                    <div className="text-6xl font-black tracking-tighter text-slate-900 dark:text-zinc-50 mb-1">
                      {sesi.skorTotal ?? 0}
                    </div>
                    <div className="text-sm font-bold text-slate-400 dark:text-zinc-600">
                      / {sesi.maxSkor ?? 0}
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <button 
                    onClick={selesaikan}
                    className={`w-full h-14 rounded-xl font-black text-sm tracking-wide transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.02] active:scale-95 shadow-md ${
                      totalUngraded > 0 
                        ? 'bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-2 border-slate-200 dark:border-zinc-700 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-none' 
                        : 'bg-indigo-600 text-white hover:bg-indigo-700 border-2 border-indigo-600 hover:border-indigo-700 shadow-indigo-600/20 hover:shadow-indigo-600/40'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Save className="h-5 w-5" /> 
                      {totalUngraded > 0 ? "Simpan Draft" : "Simpan Nilai Akhir"}
                    </div>
                  </button>
                  {sesi.gradedAt && (
                    <p className="text-xs text-center font-bold text-slate-400 mt-4">
                      Dinilai: {new Date(sesi.gradedAt).toLocaleString("id-ID", { hour: '2-digit', minute:'2-digit', day:'numeric', month:'short' })}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
