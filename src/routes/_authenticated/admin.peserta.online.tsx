import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { sesiRepo, ujianRepo, usersRepo } from "@/lib/cbt/repos";
import { Activity, AlertTriangle, Users, Timer, CheckCircle2, Search, MonitorPlay } from "lucide-react";
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
  }, [tick, search]);

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-20">
      
      {/* Sleek Enterprise Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-zinc-100">
            Pantau Ujian Live
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Monitoring aktivitas peserta secara real-time.
          </p>
        </div>
        
        {/* Minimalist Data Points */}
        <div className="flex items-center gap-8 text-sm">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-medium uppercase tracking-widest text-slate-400 mb-0.5">Sesi Aktif</span>
            <span className="text-xl font-medium text-slate-900 dark:text-white tabular-nums leading-none">{sesis.length}</span>
          </div>
          <div className="w-px h-8 bg-slate-200 dark:bg-slate-800" />
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-medium uppercase tracking-widest text-slate-400 mb-0.5">Pelanggaran</span>
            <span className="text-xl font-medium text-red-600 dark:text-red-400 tabular-nums leading-none">{totalPelanggaran}</span>
          </div>
          <div className="w-px h-8 bg-slate-200 dark:bg-slate-800" />
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-medium uppercase tracking-widest text-slate-400 mb-0.5">Rata-rata Progress</span>
            <span className="text-xl font-medium text-slate-900 dark:text-white tabular-nums leading-none">{Math.round(avgProgress)}%</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Daftar Peserta</h2>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Cari nama atau ujian..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 bg-transparent border-slate-200 dark:border-slate-800 text-sm focus-visible:ring-1 focus-visible:ring-slate-300 dark:focus-visible:ring-slate-700 shadow-none transition-all duration-300 ease-spring"
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {sesis.map(({ s, u, ex, dijawab, totalSoal, progress }) => {
              const sisaMs = s.endsAt ? Math.max(0, s.endsAt - Date.now()) : 0;
              const isCritical = sisaMs > 0 && sisaMs < 300000;
              
              return (
                <div key={s.id} className="group p-4 flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all duration-300 ease-spring hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  
                  {/* User Info */}
                  <div className="flex items-center gap-3 min-w-0 md:w-1/3">
                    <div className="flex h-8 w-8 shrink-0 rounded-full bg-slate-100 dark:bg-slate-800 items-center justify-center border border-slate-200 dark:border-slate-700">
                      <Users className="h-3.5 w-3.5 text-slate-500" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-medium text-sm text-slate-900 dark:text-slate-100 truncate group-hover:text-primary transition-colors duration-300 ease-spring">{u?.namaLengkap ?? "Unknown"}</h3>
                      <div className="text-xs text-slate-500 truncate">{ex?.nama ?? "Unknown Exam"}</div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="flex-1 w-full max-w-xs md:max-w-sm">
                    <div className="flex justify-between items-center text-xs text-slate-500 mb-1.5">
                      <span>{dijawab} / {totalSoal} Soal</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300 tabular-nums">{Math.round(progress)}%</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-primary h-full rounded-full transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
                    </div>
                  </div>

                  {/* Status & Time */}
                  <div className="flex items-center gap-6 shrink-0 md:w-1/4 justify-between md:justify-end">
                    <div className="text-right">
                      <div className="text-[10px] font-medium uppercase tracking-widest text-slate-400 mb-0.5">Sisa Waktu</div>
                      <div className={`font-mono text-sm font-medium tabular-nums ${isCritical ? 'text-red-600 animate-pulse' : 'text-slate-700 dark:text-slate-300'}`}>
                        {fmtSisa(sisaMs)}
                      </div>
                    </div>

                    <div className="w-24 text-right">
                      <div className="text-[10px] font-medium uppercase tracking-widest text-slate-400 mb-1">Status</div>
                      {s.pelanggaran > 0 ? (
                        <div className="flex items-center justify-end gap-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                          </span>
                          {s.pelanggaran} Insiden
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Aman
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {sesis.length === 0 && (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <MonitorPlay className="h-8 w-8 text-slate-300 dark:text-slate-700 mb-3" />
                <p className="text-slate-500 text-sm">Belum ada peserta yang aktif.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
