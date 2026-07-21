/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link } from "@tanstack/react-router";
import { sesiRepo, ujianRepo, usersRepo, soalRepo } from "@/lib/cbt/repos";
import { useAuthStore } from "@/lib/cbt/auth-store";
import { visibleUjians } from "@/lib/cbt/access";
import { FileEdit, CheckCircle2, ChevronRight, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/evaluasi")({
  component: EvaluasiList,
});

function EvaluasiList() {
  const user = useAuthStore((s) => s.user);
  const visibleIds = new Set(visibleUjians(user).map((u) => u.id));
  const sesis = sesiRepo.all().filter((s) => s.status === "selesai" && visibleIds.has(s.ujianId));
  const ujians = ujianRepo.all();
  const soals = soalRepo.all();
  const soalSet = new Set(soals.filter((s) => s.tipe === "essay").map((s) => s.id));

  // Group by Ujian
  const ujianMap = new Map<string, { ujian: any, totalSesi: number, belumSesi: number, totalEssay: number, belumEssay: number }>();

  sesis.forEach(s => {
    const essays = s.jawaban.filter((j) => soalSet.has(j.soalId));
    if (essays.length === 0) return;

    const belumCount = essays.filter((j) => typeof j.skor !== "number").length;
    
    if (!ujianMap.has(s.ujianId)) {
      const u = ujians.find(x => x.id === s.ujianId);
      if (!u) return;
      ujianMap.set(s.ujianId, { ujian: u, totalSesi: 0, belumSesi: 0, totalEssay: 0, belumEssay: 0 });
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

  return (
    <div className="mx-auto max-w-5xl py-8 px-6 space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Evaluasi Essay</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {totalBelumSesi > 0 
            ? `${totalBelumSesi} mahasiswa menunggu penilaian essay di berbagai ujian.` 
            : "Semua jawaban essay sudah dinilai."}
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden shadow-sm">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <CheckCircle2 className="h-8 w-8 text-slate-300 dark:text-slate-700 mb-3" />
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Semua Selesai</p>
            <p className="text-sm text-slate-500">Tidak ada ujian dengan soal essay yang perlu dinilai.</p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800/60">
            {items.map(({ ujian, totalSesi, belumSesi, totalEssay, belumEssay }) => {
              const isWarning = belumSesi > 0;

              return (
                <Link
                  key={ujian.id}
                  to="/admin/evaluasi/ujian/$id"
                  params={{ id: ujian.id }}
                  className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors group"
                >
                  <div className="flex flex-col gap-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {ujian.nama}
                      </span>
                    </div>
                    <span className="text-sm text-slate-500 dark:text-slate-400 truncate">
                      Terdapat {totalSesi} sesi ujian ({totalEssay} total jawaban essay)
                    </span>
                  </div>

                  <div className="flex items-center gap-6 shrink-0">
                    <div className="flex items-center gap-2">
                      {isWarning ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-xs font-medium border border-amber-200/50 dark:border-amber-800/50">
                          <AlertCircle className="h-3.5 w-3.5" />
                          <span>{belumSesi} Mahasiswa Belum Dinilai</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium border border-emerald-200/50 dark:border-emerald-800/50">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Semua Selesai</span>
                        </div>
                      )}
                    </div>
                    
                    <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
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
