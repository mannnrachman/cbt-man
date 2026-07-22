import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuthStore } from "@/lib/cbt/auth-store";
import {
  usersRepo,
  unitAkademikRepo,
  modulRepo,
  soalRepo,
  ujianRepo,
  sesiRepo,
} from "@/lib/cbt/repos";
import { 
  Clock, 
  Plus, 
  ArrowRight, 
  AlertCircle, 
  PlayCircle, 
  Users, 
  BookOpen, 
  FileText, 
  Activity,
  CalendarClock,
  Sparkles,
  BarChart3,
  MonitorPlay,
  ShieldCheck,
  Zap,
  CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: CommandCenter,
});

function CommandCenter() {
  const user = useAuthStore((s) => s.user)!;
  const now = Date.now();
  const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;

  // Data fetching
  const pesertaList = usersRepo.all().filter((u) => u.role === "mahasiswa");
  const soalList = soalRepo.all();
  const semuaUjian = ujianRepo.all();
  
  const newPeserta = pesertaList.filter(u => u.createdAt && (now - u.createdAt) < ONE_WEEK).length;
  const newSoal = soalList.filter(s => s.createdAt && (now - s.createdAt) < ONE_WEEK).length;
  const newUjian = semuaUjian.filter(u => u.createdAt && (now - u.createdAt) < ONE_WEEK).length;

  const counts = {
    peserta: pesertaList.length,
    unit: unitAkademikRepo.all().length,
    modul: modulRepo.all().length,
    soal: soalList.length,
    ujian: semuaUjian.length,
    sesi: sesiRepo.all().length,
  };

  const activeExams = semuaUjian.filter((u) => u.beginAt && u.endAt && now >= u.beginAt && now <= u.endAt);
  const upcomingExams = semuaUjian.filter((u) => u.beginAt && now < u.beginAt).slice(0, 4);
  const finishedExams = semuaUjian.filter((u) => u.endAt && now > u.endAt);
  
  const pendingTasks = [];
  if (finishedExams.length > 0) {
    pendingTasks.push({
      id: "eval-reports",
      title: "Ujian Selesai (Butuh Evaluasi)",
      count: finishedExams.length,
      route: "/admin/evaluasi",
      icon: <ShieldCheck className="h-5 w-5" />
    });
  }

  return (
    <div className="w-full space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      
      {/* 1. HERO SECTION (Native Style) */}
      <section className="relative overflow-hidden rounded-[22px] bg-white dark:bg-slate-900 p-8 sm:p-10 border border-slate-200 dark:border-slate-800 shadow-sleek">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-4 max-w-2xl">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
              Selamat datang kembali, <br className="hidden sm:block" />
              <span>{user.namaLengkap}</span>
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-base max-w-xl leading-relaxed">
              Pusat kendali ujian interaktif Anda. Pantau ujian secara real-time, kelola bank soal, dan hasilkan laporan performa dengan satu klik.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <Button size="lg" className="font-semibold rounded-xl h-11 px-6 shadow-sleek" asChild>
              <Link to="/admin/ujian">
                <Plus className="mr-2 h-4 w-4" /> Jadwalkan Ujian
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="font-semibold rounded-xl h-11 px-6 shadow-sleek" asChild>
              <Link to="/admin/modul">
                <BookOpen className="mr-2 h-4 w-4" /> Bank Soal
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* 2. STATS GRID (Premium Glass Cards) */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        <StatCard 
          icon={<Users className="h-5 w-5" />} 
          label="Total Peserta" 
          value={counts.peserta} 
          trend={newPeserta > 0 ? `+${newPeserta} baru` : null}
        />
        <StatCard 
          icon={<FileText className="h-5 w-5" />} 
          label="Total Ujian" 
          value={counts.ujian} 
          trend={newUjian > 0 ? `+${newUjian} ujian` : null}
        />
        <StatCard 
          icon={<BookOpen className="h-5 w-5" />} 
          label="Bank Soal" 
          value={counts.soal} 
          trend={newSoal > 0 ? `+${newSoal} soal` : null}
        />
        <StatCard 
          icon={<Zap className="h-5 w-5" />} 
          label="Total Sesi" 
          value={counts.sesi} 
        />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: Main Workflows */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Live Exams Dashboard */}
          <section className="group relative bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/60 dark:border-slate-800/60 shadow-xl shadow-slate-200/50 dark:shadow-black/20 p-1 overflow-hidden transition-all hover:shadow-2xl hover:shadow-slate-200/60 dark:hover:shadow-black/40">
            {activeExams.length > 0 && (
              <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/20 dark:bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none group-hover:bg-emerald-500/30 transition-colors duration-700" />
            )}
            
            <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl rounded-[22px] p-6 sm:p-8 h-full relative z-10">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shadow-inner">
                    <MonitorPlay className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Live Monitoring</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Pantau ujian yang sedang berlangsung secara real-time</p>
                  </div>
                </div>
                {activeExams.length > 0 && (
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-200/50 dark:border-emerald-500/20">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    {activeExams.length} Aktif
                  </div>
                )}
              </div>

              {activeExams.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-800/20">
                  <div className="h-16 w-16 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-4 shadow-inner">
                    <PlayCircle className="h-8 w-8 opacity-50" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">Sistem Siaga</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-6">
                    Belum ada ujian yang berjalan saat ini. Anda dapat bersantai atau mulai menjadwalkan ujian berikutnya.
                  </p>
                  <Button className="rounded-xl shadow-lg hover:scale-105 transition-transform" asChild>
                    <Link to="/admin/ujian">Buat Ujian Baru</Link>
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4">
                  {activeExams.map((exam) => (
                    <div key={exam.id} className="group/card flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sleek hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-700/50 transition-all duration-300 cursor-pointer">
                      <div className="flex items-center gap-4 mb-4 sm:mb-0">
                        <div className="relative">
                          <div className="absolute inset-0 bg-emerald-400 blur-md opacity-20 rounded-full group-hover/card:opacity-40 transition-opacity"></div>
                          <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900">
                            <Activity className="h-6 w-6" />
                          </div>
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1 group-hover/card:text-emerald-700 dark:group-hover/card:text-emerald-400 transition-colors">{exam.nama}</h3>
                          <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                            <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Berakhir {new Date(exam.endAt!).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })}</span>
                          </div>
                        </div>
                      </div>
                      <Button className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 rounded-xl shadow-md group-hover/card:scale-105 transition-transform" asChild>
                        <Link to="/admin/peserta/online">
                          Pantau Peserta <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

        </div>

        {/* RIGHT COLUMN: Secondary Workflows & Info */}
        <div className="lg:col-span-4 space-y-8">
          
          {/* Action Required */}
          <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/60 dark:border-slate-800/60 shadow-xl shadow-slate-200/50 dark:shadow-black/20 p-6 sm:p-8 relative overflow-hidden">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400">
                <AlertCircle className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Perlu Perhatian</h2>
            </div>

            {pendingTasks.length === 0 ? (
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Semua Terkendali</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Tidak ada tugas yang tertunda.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingTasks.map((task) => (
                  <Link key={task.id} to={task.route} className="flex flex-col p-4 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200/50 dark:border-amber-800/50 hover:shadow-md hover:border-amber-300 dark:hover:border-amber-700 transition-all group">
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-amber-600 dark:text-amber-500 bg-amber-100 dark:bg-amber-900/50 p-2 rounded-xl">
                        {task.icon}
                      </div>
                      <div className="bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-400 text-xs font-bold px-2.5 py-1 rounded-full shadow-sleek">
                        {task.count} antrean
                      </div>
                    </div>
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-1 group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors">{task.title}</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 flex items-center mt-1 font-medium">
                      Selesaikan sekarang <ArrowRight className="ml-1 h-3 w-3 group-hover:translate-x-1 transition-transform" />
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Upcoming Schedule */}
          {upcomingExams.length > 0 && (
            <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/60 dark:border-slate-800/60 shadow-xl shadow-slate-200/50 dark:shadow-black/20 p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
                  <CalendarClock className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Ujian Mendatang</h2>
              </div>
              
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-[19px] top-4 bottom-4 w-px bg-slate-200 dark:bg-slate-800"></div>
                
                <div className="space-y-6 relative">
                  {upcomingExams.map((exam) => (
                    <div key={exam.id} className="flex gap-4 group cursor-default">
                      <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white dark:bg-slate-900 border-4 border-white dark:border-slate-900 shadow-sleek">
                        <div className="h-3 w-3 rounded-full bg-blue-500 group-hover:scale-150 transition-transform duration-300"></div>
                      </div>
                      <div className="pt-2 pb-2">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-none mb-2">{exam.nama}</h3>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" /> 
                          {new Date(exam.beginAt!).toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" })} • {new Date(exam.beginAt!).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* System Info */}
          <section className="bg-slate-50 dark:bg-slate-900/30 rounded-3xl border border-slate-200/60 dark:border-slate-800/60 p-6 sm:p-8">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-4">
              Informasi Sistem
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-2">
                <span className="text-slate-600 dark:text-slate-400 font-medium">Database</span>
                <span className="font-semibold text-slate-900 dark:text-slate-300 flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500"></div> SQLite Local
                </span>
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

// Reusable Stat Card Component
function StatCard({ icon, label, value, trend }: { icon: React.ReactNode, label: string, value: number, trend?: string | null }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-[22px] p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</h3>
        <div className="text-slate-400 dark:text-slate-500">
          {icon}
        </div>
      </div>
      <div>
        <div className="flex items-end gap-2">
          <span className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{value}</span>
          {trend && (
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full mb-1.5">
              {trend}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
