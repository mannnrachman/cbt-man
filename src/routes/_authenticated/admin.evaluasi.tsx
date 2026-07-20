import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { sesiRepo, ujianRepo, soalRepo, mataKuliahRepo } from "@/lib/cbt/repos";
import { useAuthStore } from "@/lib/cbt/auth-store";
import { visibleUjians } from "@/lib/cbt/access";
import { FileSignature, Calendar, BookOpen, ChevronRight, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/evaluasi")({
  component: EvaluasiList,
});

function formatDate(ts?: number) {
  if (!ts) return "No date set";
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
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Header & Quick Stats */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Manual Grading Inbox</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">
            Evaluate student essay submissions and assign manual scores.
          </p>
        </div>
        
        {totalBelumEssay > 0 && (
          <div className="flex items-center gap-6 bg-slate-50 dark:bg-slate-900/50 px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
            <div>
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Pending Exams</div>
              <div className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight">{items.filter(i => i.belumSesi > 0).length}</div>
            </div>
            <div className="w-px h-8 bg-slate-200 dark:bg-slate-800"></div>
            <div>
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Ungraded Essays</div>
              <div className="text-lg font-bold text-amber-600 dark:text-amber-500 leading-tight">{totalBelumEssay}</div>
            </div>
          </div>
        )}
      </div>

      {/* Data List */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-950 shadow-sleek">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-xs font-bold text-slate-500 uppercase tracking-wider">
          <div className="col-span-12 sm:col-span-5">Exam Reference</div>
          <div className="hidden sm:block sm:col-span-2">Subject</div>
          <div className="hidden sm:block sm:col-span-3">Completion Progress</div>
          <div className="hidden sm:block sm:col-span-2 text-right">Status</div>
        </div>

        {items.length === 0 ? (
          <div className="py-24 text-center flex flex-col items-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-3 opacity-80" />
            <span className="text-slate-900 dark:text-slate-100 font-bold">Inbox Zero</span>
            <span className="text-sm text-slate-500 dark:text-slate-400 mt-1">All submissions have been graded.</span>
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
                  className="group block hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors cursor-pointer"
                >
                  <div className="grid grid-cols-12 gap-4 px-6 py-4 items-center">
                    
                    {/* Col 1: Exam Info */}
                    <div className="col-span-12 sm:col-span-5 flex items-start gap-3">
                      <div className="mt-0.5">
                        <FileSignature className="h-4 w-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {ujian.nama}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 font-mono">
                          <span>{ujian.id.substring(0, 8)}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1 font-sans font-medium">
                            <Calendar className="h-3 w-3" /> {formatDate(ujian.beginAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Col 2: Subject Context */}
                    <div className="hidden sm:flex sm:col-span-2 items-center">
                      {mk ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-400 truncate max-w-full">
                          <BookOpen className="h-3 w-3 shrink-0" />
                          <span className="truncate">{mk.nama}</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">No subject</span>
                      )}
                    </div>

                    {/* Col 3: Grading Progress */}
                    <div className="hidden sm:flex sm:col-span-3 flex-col justify-center">
                      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                        <span>{gradedEssay} / {totalEssay} graded</span>
                        <span className="text-slate-700 dark:text-slate-300">{Math.round(progressPct)}%</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden shadow-inner">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${progressPct === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} 
                          style={{ width: `${progressPct}%` }} 
                        />
                      </div>
                    </div>

                    {/* Col 4: Status & Action */}
                    <div className="hidden sm:flex sm:col-span-2 items-center justify-end gap-4">
                      {isWarning ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 text-[11px] font-bold text-amber-700 dark:text-amber-500 border border-amber-200/50 dark:border-amber-800/50">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                          </span>
                          {belumSesi} Needs Action
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-500">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Cleared
                        </div>
                      )}
                      <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 transition-colors shrink-0" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
