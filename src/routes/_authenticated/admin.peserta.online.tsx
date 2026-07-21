import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { sesiRepo, ujianRepo, usersRepo } from "@/lib/cbt/repos";
import { Activity, AlertTriangle, Users, Timer, CheckCircle2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/admin/peserta/online")({
  component: OnlinePage,
});

function fmtSisa(ms: number): string {
  if (ms <= 0) return "00:00";
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function OnlinePage() {
  const [, tick] = useState(0);
  const [search, setSearch] = useState("");

  useEffect(() => {
    // Refresh interval lowered to 1s for real-time countdown feel
    const t = window.setInterval(() => tick((x) => x + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  const { sesis, ujians, users, totalPelanggaran, avgProgress } = useMemo(() => {
    const rawSesis = sesiRepo.all().filter((s) => s.status === "sedang");
    const ujians = ujianRepo.all();
    const users = usersRepo.all();

    let violations = 0;
    let totalPct = 0;

    const enriched = rawSesis.map((s) => {
      const u = users.find((x) => x.id === s.pesertaId);
      const ex = ujians.find((x) => x.id === s.ujianId);
      const dijawab = s.jawaban.filter((j) => j.jawabanIds.length > 0 || j.jawabanEssay.length > 0).length;
      const totalSoal = s.soalIds.length || 1;
      const progress = (dijawab / totalSoal) * 100;
      
      violations += s.pelanggaran;
      totalPct += progress;

      return { s, u, ex, dijawab, totalSoal, progress };
    });

    const filtered = enriched.filter(({ u, ex }) => 
      (u?.namaLengkap || "").toLowerCase().includes(search.toLowerCase()) ||
      (ex?.nama || "").toLowerCase().includes(search.toLowerCase())
    );

    return {
      sesis: filtered,
      ujians,
      users,
      totalPelanggaran: violations,
      avgProgress: rawSesis.length > 0 ? totalPct / rawSesis.length : 0
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, search]); // Re-compute on tick to keep timers smooth

  return (
    <div className="mx-auto max-w-6xl space-y-8 animate-in fade-in duration-500 pb-12 pt-4">
      {/* Header Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end justify-between border-b border-slate-200 dark:border-white/10 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Live Operations Board</h1>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 pl-5">
            Pantau jalannya ujian, waktu tersisa, dan kecurangan secara real-time.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
            <Activity className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <div className="text-sm font-medium text-slate-500">Sesi Aktif</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{sesis.length} <span className="text-sm font-normal text-slate-400">peserta</span></div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <div className="text-sm font-medium text-slate-500">Total Pelanggaran</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{totalPelanggaran} <span className="text-sm font-normal text-slate-400">insiden</span></div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <div className="text-sm font-medium text-slate-500">Rata-rata Progress</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{Math.round(avgProgress)}%</div>
          </div>
        </div>
      </div>

      {/* Main Board */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <h2 className="text-lg font-semibold tracking-tight">Status Peserta</h2>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Cari nama atau ujian..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 overflow-hidden">
          <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800/60">
            {sesis.map(({ s, u, ex, dijawab, totalSoal, progress }) => {
              const sisaMs = s.endsAt ? Math.max(0, s.endsAt - Date.now()) : 0;
              const isCritical = sisaMs > 0 && sisaMs < 300000; // < 5 mins
              
              return (
                <div key={s.id} className="group flex flex-col md:flex-row md:items-center justify-between p-4 sm:px-6 hover:bg-white dark:hover:bg-slate-800/50 transition-colors gap-6">
                  
                  {/* Identitas Peserta */}
                  <div className="flex items-center gap-4 min-w-0 md:w-1/3">
                    <div className="h-10 w-10 shrink-0 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center border border-slate-300 dark:border-slate-700">
                      <Users className="h-5 w-5 text-slate-500" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">{u?.namaLengkap ?? "Unknown"}</h3>
                      <div className="text-xs text-slate-500 truncate mt-0.5">{ex?.nama ?? "Unknown Exam"}</div>
                    </div>
                  </div>

                  {/* Progress Mengerjakan */}
                  <div className="flex-1 w-full space-y-1.5 md:px-4">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Progress</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{dijawab} / {totalSoal} Soal</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                    </div>
                  </div>

                  <div className="flex items-center gap-6 shrink-0 justify-between md:justify-end">
                    {/* Waktu */}
                    <div className="text-right">
                      <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-0.5">Sisa Waktu</div>
                      <div className={`font-mono text-lg font-bold flex items-center gap-1.5 ${isCritical ? 'text-red-600 dark:text-red-400 animate-pulse' : 'text-slate-700 dark:text-slate-300'}`}>
                        <Timer className="h-4 w-4" />
                        {fmtSisa(sisaMs)}
                      </div>
                    </div>

                    {/* Pelanggaran */}
                    <div className="w-24 text-right">
                      <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1">Pelanggaran</div>
                      {s.pelanggaran > 0 ? (
                        <div className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400 text-sm font-bold border border-red-200 dark:border-red-800">
                          {s.pelanggaran}x
                        </div>
                      ) : (
                        <div className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 text-sm font-medium">
                          Aman
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              );
            })}

            {sesis.length === 0 && (
              <div className="p-16 text-center">
                <div className="mx-auto w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                  <Activity className="h-8 w-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">Tidak ada aktivitas</h3>
                <p className="text-sm text-slate-500">Saat ini tidak ada peserta yang sedang melangsungkan ujian.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
