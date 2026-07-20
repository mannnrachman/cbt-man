import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { sesiRepo, ujianRepo, soalRepo, mataKuliahRepo } from "@/lib/cbt/repos";
import { useAuthStore } from "@/lib/cbt/auth-store";
import { visibleUjians } from "@/lib/cbt/access";
import { ClipboardCheck, Calendar, BookOpen, ChevronRight, CheckCircle2 } from "lucide-react";

import { hydrateRepos } from "@/lib/cbt/repos";

export const Route = createFileRoute("/_authenticated/admin/evaluasi/")({
  loader: async () => {
    try {
      await hydrateRepos();
    } catch (e) {
      console.error(e);
    }
  },
  component: EvaluasiList,
});

function formatDate(ts?: number) {
  if (!ts) return "Belum diatur";
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(ts));
}

function EvaluasiList() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const visibleIds = new Set(visibleUjians(user).map((u) => u.id));
  const sesis = sesiRepo.all().filter((s) => s.status === "selesai" && visibleIds.has(s.ujianId));
  const ujians = ujianRepo.all();
  const soals = soalRepo.all();
  const mks = mataKuliahRepo.all();
  const soalSet = new Set(soals.filter((s) => s.tipe === "essay").map((s) => s.id));

  const ujianMap = new Map<string, { ujian: any, mk: any, totalSesi: number, belumSesi: number, totalEssay: number, belumEssay: number }>();

  sesis.forEach(s => {
    const essays = s.jawaban.filter((j) => soalSet.has(j.soalId));
    if (essays.length === 0) return;

    const belumCount = essays.filter((j) => typeof j.skor !== "number").length;
    
    if (!ujianMap.has(s.ujianId)) {
      const u = ujians.find(x => x.id === s.ujianId);
      if (!u) return;
      const mk = mks.find(m => m.id === u.mataKuliahId);
      ujianMap.set(s.ujianId, { ujian: u, mk, totalSesi: 0, belumSesi: 0, totalEssay: 0, belumEssay: 0 });
    }
    
    const entry = ujianMap.get(s.ujianId)!;
    entry.totalSesi += 1;
    entry.totalEssay += essays.length;
    entry.belumEssay += belumCount;
    if (belumCount > 0) {
      entry.belumSesi += 1;
    }
  });

  const items = Array.from(ujianMap.values()).sort((a, b) => b.belumSesi - a.belumSesi);
  const totalBelumSesi = items.reduce((acc, curr) => acc + curr.belumSesi, 0);
  const totalBelumEssay = items.reduce((acc, curr) => acc + curr.belumEssay, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-20">
      {/* Sleek Enterprise Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-zinc-100">
            Kotak Masuk Evaluasi
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Evaluasi dan berikan nilai pada jawaban essay peserta secara manual.
          </p>
        </div>
        
        {totalBelumEssay > 0 && (
          <div className="flex items-center gap-8 text-sm">
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-medium uppercase tracking-widest text-slate-400 mb-0.5">Ujian Tertunda</span>
              <span className="text-xl font-medium text-slate-900 dark:text-white tabular-nums leading-none">
                {items.filter(i => i.belumSesi > 0).length} <span className="text-sm text-slate-400 font-medium ml-1">Dokumen</span>
              </span>
            </div>
            <div className="w-px h-8 bg-slate-200 dark:bg-slate-800" />
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-medium uppercase tracking-widest text-slate-400 mb-0.5">Antrean Essay</span>
              <span className="text-xl font-medium text-amber-600 dark:text-amber-500 tabular-nums leading-none">
                {totalBelumEssay} <span className="text-sm text-amber-500/70 font-medium ml-1">Jawaban</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Data List (Concentric Borders Math & Advanced Soft Shadow) */}
      <div className="p-1.5 rounded-[20px] border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sleek">
        <div className="rounded-2xl overflow-hidden bg-white dark:bg-slate-900 flex flex-col">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/50 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            <div className="col-span-12 sm:col-span-5">Referensi Ujian</div>
            <div className="hidden sm:block sm:col-span-2">Mata Kuliah</div>
            <div className="hidden sm:block sm:col-span-3">Progres Penilaian</div>
            <div className="hidden sm:block sm:col-span-2 text-right">Status</div>
          </div>

          {items.length === 0 ? (
            <div className="py-24 text-center flex flex-col items-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-3 opacity-80" />
              <span className="text-slate-900 dark:text-slate-100 font-bold">Kotak Masuk Bersih</span>
              <span className="text-sm text-slate-500 dark:text-slate-400 mt-1">Semua jawaban telah selesai dinilai.</span>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800/60">
              {items.map(({ ujian, mk, totalSesi, belumSesi, totalEssay, belumEssay }) => {
                const isWarning = belumSesi > 0;
                const gradedEssay = totalEssay - belumEssay;
                const progressPct = totalEssay > 0 ? (gradedEssay / totalEssay) * 100 : 100;

                return (
                  <Link 
                    key={ujian.id} 
                    to="/admin/evaluasi/ujian/$id" 
                    params={{ id: ujian.id }}
                    className="group block transition-all duration-300 ease-spring hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer"
                  >
                    <div className="grid grid-cols-12 gap-4 px-6 py-4 items-center">
                      
                      {/* Col 1: Exam Info */}
                      <div className="col-span-12 sm:col-span-5 flex items-center gap-3.5">
                        <div className="flex items-center justify-center h-10 w-10 shrink-0 rounded-[10px] bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/50 group-hover:bg-primary/10 group-hover:border-primary/20 transition-all duration-300 ease-spring">
                          <ClipboardCheck className="h-5 w-5 text-slate-500 group-hover:text-primary transition-all duration-300 ease-spring" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-sm text-slate-900 dark:text-slate-100 truncate group-hover:text-primary transition-colors duration-300 ease-spring">
                            {ujian.nama}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                            <span className="font-mono">{ujian.id.substring(0, 8)}</span>
                            <span className="text-slate-300 dark:text-slate-700">•</span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 -translate-y-[0.5px]" /> {formatDate(ujian.beginAt)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Col 2: Subject Context */}
                      <div className="hidden sm:flex sm:col-span-2 items-center">
                        {mk ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-400 truncate max-w-full">
                            <BookOpen className="h-3 w-3 shrink-0 -translate-y-[0.5px]" />
                            <span className="truncate">{mk.nama}</span>
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Tanpa mata kuliah</span>
                        )}
                      </div>

                      {/* Col 3: Grading Progress */}
                      <div className="hidden sm:flex sm:col-span-3 flex-col justify-center">
                        <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 mb-1.5 tabular-nums">
                          <span>{gradedEssay} / {totalEssay} dinilai</span>
                          <span className="text-slate-700 dark:text-slate-300">{Math.round(progressPct)}%</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ease-out ${progressPct === 100 ? 'bg-emerald-500' : 'bg-primary'}`} 
                            style={{ width: `${progressPct}%` }} 
                          />
                        </div>
                      </div>

                      {/* Col 4: Status & Action */}
                      <div className="hidden sm:flex sm:col-span-2 items-center justify-end gap-4">
                        {isWarning ? (
                          <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-500 tabular-nums">
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                            </span>
                            {belumSesi} Tertunda
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Selesai
                          </div>
                        )}
                        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all duration-300 ease-spring shrink-0" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
