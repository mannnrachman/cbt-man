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
import { Clock, Plus, ArrowRight, AlertCircle, PlayCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: CommandCenter,
});

function CommandCenter() {
  const user = useAuthStore((s) => s.user)!;
  const now = Date.now();

  // Metrics
  const counts = {
    peserta: usersRepo.all().filter((u) => u.role === "mahasiswa").length,
    group: groupsRepo.all().length,
    modul: modulRepo.all().length,
    soal: soalRepo.all().length,
    ujian: ujianRepo.all().length,
    sesi: sesiRepo.all().length,
  };

  // Derive today's workflow context
  const semuaUjian = ujianRepo.all();
  const activeExams = semuaUjian.filter((u) => u.beginAt && u.endAt && now >= u.beginAt && now <= u.endAt);
  const upcomingExams = semuaUjian.filter((u) => u.beginAt && now < u.beginAt).slice(0, 3);
  
  // Fake some pending tasks for UX demonstration (e.g., grading essays)
  const pendingTasks = [
    { id: 1, title: "Evaluasi Essay: Ujian Akhir Semester", count: 12, route: "/admin/evaluasi" },
    { id: 2, title: "Review Modul: Algoritma Dasar", count: 5, route: "/admin/modul" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-12 pt-6 animate-in fade-in duration-500">
      
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
            <span suppressHydrationWarning>
              {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}
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
          <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-4">
              Ujian Berlangsung
            </h2>
            
            {activeExams.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-dashed border-slate-200 dark:border-slate-700">
                Tidak ada ujian yang dijadwalkan berjalan saat ini.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {activeExams.map((exam) => (
                  <div key={exam.id} className="flex items-center justify-between p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400">
                        <PlayCircle className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100">{exam.nama}</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                          Berakhir pada <span suppressHydrationWarning className="font-medium text-slate-800 dark:text-slate-200">{new Date(exam.endAt!).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span>
                        </p>
                      </div>
                    </div>
                    <Button variant="default" size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" asChild>
                      <Link to="/admin/peserta/online">
                        Pantau <ArrowRight className="ml-2 h-4 w-4" />
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
            <div className="flex flex-col gap-3">
              {pendingTasks.map((task) => (
                <Link key={task.id} to={task.route} className="flex items-start justify-between p-4 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/50 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors cursor-pointer group">
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
                  <div className="text-amber-600 dark:text-amber-500 opacity-50 group-hover:opacity-100 transition-opacity">
                    <ArrowRight className="h-5 w-5" />
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* Upcoming Schedule */}
          {upcomingExams.length > 0 && (
            <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-4">
                Akan Datang
              </h2>
              <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
                {upcomingExams.map((exam) => (
                  <div key={exam.id} className="flex items-center gap-4 py-3">
                    <div className="text-slate-400 dark:text-slate-500">
                      <Clock className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-medium text-slate-800 dark:text-slate-200">{exam.nama}</h3>
                    </div>
                    <div suppressHydrationWarning className="ml-auto text-sm font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-md">
                      {new Date(exam.beginAt!).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

        </div>

        {/* RIGHT COLUMN (35%): Density & High-Level Metrics */}
        <div className="lg:col-span-4 space-y-8">
          
          <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-6">
              Database Metrics
            </h2>
            <div className="grid grid-cols-2 gap-x-4 gap-y-6">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Peserta</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-slate-50">{counts.peserta}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Grup</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-slate-50">{counts.group}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Modul</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-slate-50">{counts.modul}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Soal</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-slate-50">{counts.soal}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ujian</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-slate-50">{counts.ujian}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Sesi</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-slate-50">{counts.sesi}</p>
              </div>
            </div>
          </section>

          <section className="bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-4">
              Sistem
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-2">
                <span className="text-slate-600 dark:text-slate-400 font-medium">Database</span>
                <span className="font-semibold text-slate-900 dark:text-slate-300">SQLite local</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-2">
                <span className="text-slate-600 dark:text-slate-400 font-medium">Engine</span>
                <span className="font-semibold text-slate-900 dark:text-slate-300">Prisma ORM</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 dark:text-slate-400 font-medium">Version</span>
                <span className="font-semibold text-slate-900 dark:text-slate-300">v1.2.0</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
