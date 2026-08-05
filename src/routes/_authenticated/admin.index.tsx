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
  MonitorPlay,
  ShieldCheck,
  Zap,
  CheckCircle2,
  TrendingUp,
  Key,
  Layers,
  Radio,
  Sparkles,
  ArrowUpRight,
  Database,
  Server
} from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: CommandCenter,
});

function CommandCenter() {
  const user = useAuthStore((s) => s.user)!;
  const now = Date.now();
  const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;

  // Data fetching & calculations
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
      title: "Ujian Selesai (Evaluasi & Rekap)",
      desc: `${finishedExams.length} ujian siap dianalisis nilainya.`,
      count: finishedExams.length,
      route: "/admin/evaluasi",
      icon: <ShieldCheck className="h-6 w-6 text-black stroke-[3]" />
    });
  }

  // Format Helper for Numbers
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}rb`;
    return num.toString();
  };

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500 pb-16">
      
      {/* 1. TOP OPERATIONAL STATUS BAR (Neobrutalism) */}
      <section className="relative rounded-2xl bg-[#FFE800] dark:bg-[#FFE800] text-black p-6 sm:p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] border-4 border-black overflow-hidden">
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-black rounded-full opacity-10"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <span className="relative flex h-2.5 w-2.5">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${activeExams.length > 0 ? "bg-[#FF006B]" : "bg-black"}`}></span>
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${activeExams.length > 0 ? "bg-[#FF006B]" : "bg-black"}`}></span>
              </span>
              {activeExams.length > 0 
                ? `${activeExams.length} Ujian Aktif` 
                : "Sistem CBT Siaga"}
            </div>

            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-black uppercase drop-shadow-[2px_2px_0px_rgba(255,255,255,1)]">
              Pusat Kendali CBT
            </h1>
            <p className="text-sm font-bold text-black/80 max-w-xl">
              Halo, <span className="text-black font-black bg-white px-2 py-0.5 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">{user.namaLengkap}</span>. Pantau dan kelola ujian kampus dengan performa maksimal.
            </p>
          </div>

          {/* Quick Primary Actions */}
          <div className="flex flex-wrap items-center gap-4 shrink-0">
            <Button size="lg" className="bg-[#00FF41] hover:bg-[#00e63a] text-black font-black uppercase tracking-wider rounded-xl border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all" asChild>
              <Link to="/admin/ujian">
                <Plus className="mr-2 h-5 w-5 stroke-[3]" />
                Buat Ujian
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="bg-white hover:bg-slate-100 text-black font-black uppercase tracking-wider rounded-xl border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all" asChild>
              <Link to="/admin/peserta/online">
                <Radio className="mr-2 h-5 w-5 text-[#FF006B] stroke-[3]" />
                Pantau Live
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* 2. EXECUTIVE KPI CARDS GRID (Neobrutalism) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <KpiCard
          label="Total Peserta"
          value={formatNumber(counts.peserta)}
          subtitle="Mahasiswa terdaftar"
          icon={<Users className="h-7 w-7 text-black stroke-[2.5]" />}
          trend={newPeserta > 0 ? `+${newPeserta} baru` : null}
          trendPositive={true}
        />
        <KpiCard
          label="Total Ujian"
          value={formatNumber(counts.ujian)}
          subtitle={`${activeExams.length} Aktif • ${upcomingExams.length} Nanti`}
          icon={<MonitorPlay className="h-7 w-7 text-black stroke-[2.5]" />}
          trend={newUjian > 0 ? `+${newUjian} mgg ini` : null}
          trendPositive={true}
        />
        <KpiCard
          label="Bank Soal"
          value={formatNumber(counts.soal)}
          subtitle="Soal siap ujikan"
          icon={<FileText className="h-7 w-7 text-black stroke-[2.5]" />}
          trend={newSoal > 0 ? `+${newSoal} baru` : null}
          trendPositive={true}
        />
        <KpiCard
          label="Total Sesi"
          value={formatNumber(counts.sesi)}
          subtitle={`${counts.modul} Modul MK`}
          icon={<Layers className="h-7 w-7 text-black stroke-[2.5]" />}
        />
      </section>

      {/* 3. MAIN DASHBOARD CONTENT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
        
        {/* LEFT COLUMN: Main Workflows (8 Cols) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Live Surveillance Panel */}
          <div className="rounded-2xl bg-[#FF006B] dark:bg-[#FF006B] text-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
            <div className="flex items-center justify-between pb-4 mb-5 border-b-4 border-black">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-white text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <Activity className="h-6 w-6 stroke-[3]" />
                </div>
                <div>
                  <h2 className="text-xl font-black tracking-tight text-white uppercase drop-shadow-[2px_2px_0px_rgba(0,0,0,1)]">Pengawasan Live</h2>
                  <p className="text-sm font-bold text-white/90">Monitoring real-time stabilitas dan peserta</p>
                </div>
              </div>
              {activeExams.length > 0 && (
                <span className="px-4 py-1.5 text-sm font-black uppercase rounded-full bg-[#FFE800] text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  {activeExams.length} Berlangsung
                </span>
              )}
            </div>

            {activeExams.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center rounded-xl bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-6">
                <div className="h-16 w-16 rounded-xl bg-[#00FF41] border-2 border-black flex items-center justify-center mb-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <CheckCircle2 className="h-8 w-8 text-black stroke-[3]" />
                </div>
                <h3 className="text-xl font-black text-black uppercase mb-2">Sistem Siaga Penuh</h3>
                <p className="text-sm font-bold text-black/70 max-w-md mb-6">
                  Tidak ada ujian aktif saat ini. Cek jadwal ujian mendatang atau siapkan bank soal baru.
                </p>
                <Button size="lg" className="bg-[#FFE800] hover:bg-[#e6d100] text-black font-black uppercase border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all" asChild>
                  <Link to="/admin/ujian">Lihat Jadwal Ujian</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {activeExams.map((exam) => (
                  <div key={exam.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all">
                    <div className="flex items-center gap-4 mb-4 sm:mb-0">
                      <div className="h-12 w-12 rounded-xl bg-[#00F0FF] border-2 border-black text-black flex items-center justify-center shrink-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        <Radio className="h-6 w-6 stroke-[3] animate-pulse" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-black uppercase leading-tight">{exam.nama}</h3>
                        <div className="flex items-center gap-2 mt-1 text-sm font-bold text-black/70">
                          <Clock className="h-4 w-4 stroke-[3]" />
                          <span>Berakhir pukul {new Date(exam.endAt!).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })} WIB</span>
                        </div>
                      </div>
                    </div>
                    <Button size="lg" className="bg-black hover:bg-slate-800 text-white font-black uppercase border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all px-6" asChild>
                      <Link to="/admin/peserta/online">
                        Pantau <ArrowRight className="ml-2 h-5 w-5 stroke-[3]" />
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Operational Shortcuts Console */}
          <div className="rounded-2xl bg-white dark:bg-slate-800 border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
            <h2 className="text-xl font-black uppercase text-black dark:text-white mb-6 drop-shadow-[1px_1px_0px_rgba(255,255,255,1)] dark:drop-shadow-none">Aksi Cepat Admin</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <ShortcutCard
                title="Buat Ujian"
                desc="Atur jadwal"
                icon={<Plus className="h-6 w-6 text-black stroke-[3]" />}
                href="/admin/ujian"
              />
              <ShortcutCard
                title="Rilis Token"
                desc="Generate token"
                icon={<Key className="h-6 w-6 text-black stroke-[3]" />}
                href="/admin/ujian"
              />
              <ShortcutCard
                title="Bank Soal"
                desc="Kelola soal"
                icon={<BookOpen className="h-6 w-6 text-black stroke-[3]" />}
                href="/admin/modul"
              />
              <ShortcutCard
                title="Kartu CBT"
                desc="Cetak kartu"
                icon={<Users className="h-6 w-6 text-black stroke-[3]" />}
                href="/admin/peserta/kartu"
              />
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Urgent Tasks & Schedule (4 Cols) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Urgent Action / Pending Tasks Queue */}
          <div className="rounded-2xl bg-white dark:bg-slate-800 border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
            <div className="flex items-center gap-3 mb-5 pb-4 border-b-4 border-black">
              <div className="p-2 bg-[#FFE800] border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <AlertCircle className="h-6 w-6 text-black stroke-[3]" />
              </div>
              <h2 className="text-lg font-black uppercase text-black dark:text-white">Perlu Perhatian</h2>
            </div>

            {pendingTasks.length === 0 ? (
              <div className="p-5 rounded-xl bg-[#00FF41] border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center gap-4">
                <div className="p-2 bg-white rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <CheckCircle2 className="h-6 w-6 text-black stroke-[3]" />
                </div>
                <div>
                  <p className="text-sm font-black uppercase text-black">Antrean Selesai</p>
                  <p className="text-xs font-bold text-black/70">Tidak ada tugas tertunda.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingTasks.map((task) => (
                  <Link key={task.id} to={task.route} className="block p-5 rounded-xl bg-[#FFE800] border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all group">
                    <div className="flex justify-between items-start mb-3">
                      <div className="p-2 rounded-lg bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] group-hover:rotate-6 transition-transform">
                        {task.icon}
                      </div>
                      <span className="px-3 py-1 text-xs font-black uppercase rounded-lg bg-black text-white shadow-[2px_2px_0px_0px_rgba(255,255,255,0.2)]">
                        {task.count} Pending
                      </span>
                    </div>
                    <h3 className="font-black uppercase text-black text-base mb-1">{task.title}</h3>
                    <p className="text-sm font-bold text-black/80 mb-4">{task.desc}</p>
                    <div className="inline-flex items-center px-3 py-1.5 bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-xs font-black uppercase text-black group-hover:-translate-y-0.5 transition-transform">
                      Proses Sekarang <ArrowUpRight className="ml-1.5 h-4 w-4 stroke-[3]" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming Exams Timeline */}
          {upcomingExams.length > 0 && (
            <div className="rounded-2xl bg-white dark:bg-slate-800 border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
              <div className="flex items-center justify-between mb-5 pb-4 border-b-4 border-black">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#00F0FF] border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    <CalendarClock className="h-6 w-6 text-black stroke-[3]" />
                  </div>
                  <h2 className="text-lg font-black uppercase text-black dark:text-white">Ujian Mendatang</h2>
                </div>
                <span className="px-3 py-1 text-xs font-black uppercase bg-black text-white rounded border-2 border-black">{upcomingExams.length} Jadwal</span>
              </div>
              
              <div className="space-y-4">
                {upcomingExams.map((exam) => (
                  <div key={exam.id} className="p-4 rounded-xl bg-slate-100 dark:bg-slate-700 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-transform">
                    <h3 className="text-sm font-black uppercase text-black dark:text-white mb-3">{exam.nama}</h3>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 border-2 border-black text-xs font-bold text-black dark:text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      <Clock className="h-4 w-4 stroke-[3]" />
                      <span suppressHydrationWarning>
                        {new Date(exam.beginAt!).toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" })} • {new Date(exam.beginAt!).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* System Environment Telemetry */}
          <div className="rounded-2xl bg-black text-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6 space-y-4">
            <h2 className="text-lg font-black uppercase mb-4 text-[#00F0FF] drop-shadow-[1px_1px_0px_rgba(255,255,255,0.3)]">Telemetri Sistem</h2>
            <div className="flex items-center justify-between border-b-2 border-slate-700 pb-3">
              <span className="text-sm font-bold uppercase flex items-center gap-3">
                <Database className="h-5 w-5 text-[#FFE800] stroke-[3]" /> Database
              </span>
              <span className="text-xs font-black uppercase px-2 py-1 bg-[#FFE800] text-black border-2 border-[#FFE800]">SQLite Local</span>
            </div>
            <div className="flex items-center justify-between border-b-2 border-slate-700 pb-3">
              <span className="text-sm font-bold uppercase flex items-center gap-3">
                <Server className="h-5 w-5 text-[#FF006B] stroke-[3]" /> ORM Engine
              </span>
              <span className="text-xs font-black uppercase px-2 py-1 bg-[#FF006B] text-white border-2 border-[#FF006B]">Prisma Client</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold uppercase flex items-center gap-3">
                <Zap className="h-5 w-5 text-[#00FF41] stroke-[3]" /> Versi Sistem
              </span>
              <span className="text-xs font-black uppercase px-3 py-1 bg-[#00FF41] text-black border-2 border-[#00FF41] shadow-[2px_2px_0px_0px_rgba(255,255,255,0.5)]">v1.2.0</span>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}

// ----------------------------------------------------------------------
// REUSABLE DASHBOARD ARCHITECTURE COMPONENTS
// ----------------------------------------------------------------------

function KpiCard({ 
  label, 
  value, 
  subtitle, 
  icon, 
  trend, 
  trendPositive 
}: { 
  label: string; 
  value: string; 
  subtitle: string; 
  icon: React.ReactNode; 
  trend?: string | null;
  trendPositive?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-white dark:bg-slate-800 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-5 hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all group">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[11px] font-black uppercase tracking-widest text-black dark:text-white bg-slate-100 dark:bg-slate-700 px-2.5 py-1 rounded border-2 border-black">{label}</span>
        <div className="p-2 rounded-xl bg-[#00F0FF] border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] group-hover:rotate-12 transition-transform">
          {icon}
        </div>
      </div>
      
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-4xl font-black text-black dark:text-white tracking-tighter">{value}</span>
        {trend && (
          <span className={`inline-flex items-center text-[10px] font-black uppercase px-2 py-0.5 rounded border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
            trendPositive 
              ? "bg-[#00FF41] text-black" 
              : "bg-[#FF006B] text-white"
          }`}>
            <TrendingUp className="mr-1 h-3 w-3 inline stroke-[3]" />
            {trend}
          </span>
        )}
      </div>
      
      <p className="text-xs font-bold text-slate-600 dark:text-slate-300">{subtitle}</p>
    </div>
  );
}

function ShortcutCard({
  title,
  desc,
  icon,
  href
}: {
  title: string;
  desc: string;
  icon: React.ReactNode;
  href: string;
}) {
  return (
    <Link to={href} className="flex flex-col p-4 rounded-xl bg-[#00F0FF] border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all group">
      <div className="p-2.5 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] w-fit mb-3 group-hover:scale-110 group-hover:-rotate-6 transition-transform">
        {icon}
      </div>
      <h3 className="text-sm font-black uppercase tracking-wider text-black leading-tight mb-1">{title}</h3>
      <p className="text-[11px] font-bold text-black/80 line-clamp-1">{desc}</p>
    </Link>
  );
}


