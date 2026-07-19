import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuthStore } from "@/lib/cbt/auth-store";
import {
  usersRepo,
  groupsRepo,
  modulRepo,
  soalRepo,
  ujianRepo,
  sesiRepo,
} from "@/lib/cbt/repos";
import { Clock, Plus, ArrowRight, AlertCircle, PlayCircle, Users, BookOpen, FileText, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: CommandCenter,
});

function CommandCenter() {
  const user = useAuthStore((s) => s.user)!;
  const now = Date.now();
  const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;

  // Real Metrics with week-over-week trends
  const pesertaList = usersRepo.all().filter((u) => u.role === "mahasiswa");
  const soalList = soalRepo.all();
  const semuaUjian = ujianRepo.all();
  
  const newPeserta = pesertaList.filter(u => u.createdAt && (now - u.createdAt) < ONE_WEEK).length;
  const newSoal = soalList.filter(s => s.createdAt && (now - s.createdAt) < ONE_WEEK).length;
  const newUjian = semuaUjian.filter(u => u.createdAt && (now - u.createdAt) < ONE_WEEK).length;

  const counts = {
    peserta: pesertaList.length,
    group: groupsRepo.all().length,
    modul: modulRepo.all().length,
    soal: soalList.length,
    ujian: semuaUjian.length,
    sesi: sesiRepo.all().length,
  };

  // Derive today's workflow context
  const activeExams = semuaUjian.filter((u) => u.beginAt && u.endAt && now >= u.beginAt && now <= u.endAt);
  const upcomingExams = semuaUjian.filter((u) => u.beginAt && now < u.beginAt).slice(0, 3);
  const finishedExams = semuaUjian.filter((u) => u.endAt && now > u.endAt);
  
  // Real Pending Tasks Logic
  const pendingTasks = [];
  if (finishedExams.length > 0) {
    pendingTasks.push({
      id: "eval-reports",
      title: "Ujian Selesai (Butuh Laporan/Evaluasi)",
      count: finishedExams.length,
      route: "/admin/laporan",
      type: "warning"
    });
  }
  
  // Add a generic task if nothing is pending to show the empty state works, but let's just use empty state
  
  return (
    <div className="mx-auto max-w-6xl space-y-8 animate-in fade-in duration-500">
      
      {/* 1. Header (The "Now" Context) */}
      <header className="flex flex-col gap-4 md:flex-row md:items-end justify-between border-b border-slate-200 dark:border-white/10 pb-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Command Center
          </h1>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400">
            <span className="flex items-center gap-2 px-2 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-md border border-emerald-200 dark:border-emerald-500/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Systems operational
            </span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span>
              {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button size="sm" variant="outline" className="h-9 shadow-sm font-semibold" asChild>
            <Link to="/admin/modul">
              <Plus className="mr-2 h-4 w-4" />
              Draft Soal
            </Link>
          </Button>
          <Button size="sm" className="h-9 shadow-sm font-semibold" asChild>
            <Link to="/admin/ujian">
              Jadwalkan Ujian
            </Link>
          </Button>
        </div>
      </header>

      {/* 2. Asymmetrical Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN (65%): Primary Workflows */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Active Workflows Panel */}
          <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 relative overflow-hidden">
            {activeExams.length > 0 && (
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 dark:bg-emerald-500/5 blur-3xl -mr-10 -mt-10 rounded-full pointer-events-none" />
            )}
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-500" /> Ujian Berlangsung
            </h2>
            
            {activeExams.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-dashed border-slate-200 dark:border-slate-700">
                <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
                  <PlayCircle className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">Tidak ada ujian aktif</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-5 max-w-sm">
                  Belum ada ujian yang dijadwalkan berjalan pada waktu ini. Anda dapat menjadwalkan ujian baru sekarang.
                </p>
                <Button size="sm" asChild>
                  <Link to="/admin/ujian">
                    <Plus className="mr-2 h-4 w-4" /> Buat Ujian Baru
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3 relative z-10">
                {activeExams.map((exam) => (
                  <div key={exam.id} className="flex items-center justify-between p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 rounded-lg hover:border-emerald-200 dark:hover:border-emerald-800/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 shadow-sm">
                        <PlayCircle className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100">{exam.nama}</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                          Berakhir pada <span className="font-medium text-slate-800 dark:text-slate-200">{new Date(exam.endAt!).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span>
                        </p>
                      </div>
                    </div>
                    <Button variant="default" size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm" asChild>
                      <Link to="/admin/peserta/online">
                        Pantau Live <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Pending Tasks / Bottlenecks */}
          <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-4">
              Perlu Perhatian
            </h2>
            
            {pendingTasks.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-slate-100 dark:border-slate-800">
                <span className="flex items-center justify-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Semua tugas sudah diselesaikan.
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {pendingTasks.map((task) => (
                  <Link key={task.id} to={task.route} className="flex items-start justify-between p-4 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/50 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/40 transition-colors cursor-pointer group shadow-sm">
                    <div className="flex items-start gap-4">
                      <div className="mt-0.5 text-amber-600 dark:text-amber-500">
                        <AlertCircle className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors">
                          {task.title}
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                          <span className="font-medium text-amber-700 dark:text-amber-500">{task.count} item</span> menunggu tindakan
                        </p>
                      </div>
                    </div>
                    <div className="text-amber-600 dark:text-amber-500 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
                      <ArrowRight className="h-5 w-5" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Upcoming Schedule */}
          {upcomingExams.length > 0 && (
            <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-4">
                Ujian Mendatang
              </h2>
              <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
                {upcomingExams.map((exam) => (
                  <div key={exam.id} className="flex items-center gap-4 py-3 group hover:bg-slate-50 dark:hover:bg-slate-800/30 -mx-4 px-4 transition-colors">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500">
                      <Clock className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100">{exam.nama}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {exam.endAt ? `${Math.round((exam.endAt - exam.beginAt!) / 60000)} menit` : "Waktu fleksibel"}
                      </p>
                    </div>
                    <div className="ml-auto text-sm font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-md shadow-sm">
                      {new Date(exam.beginAt!).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

        </div>

        {/* RIGHT COLUMN (35%): Density & High-Level Metrics */}
        <div className="lg:col-span-4 space-y-6">
          
          <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-6">
              Ikhtisar Data
            </h2>
            <div className="grid grid-cols-2 gap-x-4 gap-y-6">
              <div className="space-y-1 relative group cursor-default">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Users className="h-3 w-3" /> Peserta
                </p>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-bold text-slate-900 dark:text-slate-50">{counts.peserta}</p>
                  {newPeserta > 0 && <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded-full">+{newPeserta} mgg ini</span>}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Grup</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-slate-50">{counts.group}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <BookOpen className="h-3 w-3" /> Modul
                </p>
                <p className="text-3xl font-bold text-slate-900 dark:text-slate-50">{counts.modul}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Soal</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-bold text-slate-900 dark:text-slate-50">{counts.soal}</p>
                  {newSoal > 0 && <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded-full">+{newSoal} mgg ini</span>}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <FileText className="h-3 w-3" /> Ujian
                </p>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-bold text-slate-900 dark:text-slate-50">{counts.ujian}</p>
                  {newUjian > 0 && <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded-full">+{newUjian}</span>}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Sesi</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-slate-50">{counts.sesi}</p>
              </div>
            </div>
          </section>

          {/* Quick Links instead of System Card */}
          <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
             <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-4">
              Pintasan Cepat
            </h2>
            <div className="space-y-2">
              <Link to="/admin/peserta" className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-colors group">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Kelola Peserta & Grup</span>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link to="/admin/laporan" className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-colors group">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Cetak Laporan Nilai</span>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link to="/admin/panduan" className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-colors group">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Buka Panduan Aplikasi</span>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
