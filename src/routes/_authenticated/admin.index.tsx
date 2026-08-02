import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuthStore } from "@/lib/cbt/auth-store";
import {
  usersRepo,
  modulRepo,
  soalRepo,
  ujianRepo,
  sesiRepo,
  configRepo,
} from "@/lib/cbt/repos";
import { canAccessAdminPath } from "./admin";
import {
  Clock,
  Plus,
  ArrowRight,
  AlertCircle,
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
  ArrowUpRight,
  Database,
  Server
} from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: CommandCenter,
});

function CommandCenter() {
  const user = useAuthStore((s) => s.user);
  const now = Date.now();
  const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;

  // Data fetching & calculations
  const pesertaList = usersRepo.all().filter((u) => u.role === "mahasiswa");
  const soalList = soalRepo.all();
  const semuaUjian = ujianRepo.all();
  const cfg = configRepo.get();
  if (!user) return null;
  const canAccess = (path: string) => canAccessAdminPath(user, path, cfg);

  const newPeserta = pesertaList.filter(u => u.createdAt && (now - u.createdAt) < ONE_WEEK).length;
  const newSoal = soalList.filter(s => s.createdAt && (now - s.createdAt) < ONE_WEEK).length;
  const newUjian = semuaUjian.filter(u => u.createdAt && (now - u.createdAt) < ONE_WEEK).length;

  const counts = {
    peserta: pesertaList.length,
    modul: modulRepo.all().length,
    soal: soalList.length,
    ujian: semuaUjian.length,
    sesi: sesiRepo.all().length,
  };

  const activeExams = semuaUjian.filter((u) => u.beginAt && u.endAt && now >= u.beginAt && now <= u.endAt);
  const upcoming = semuaUjian
    .filter((u): u is typeof u & { beginAt: number } => typeof u.beginAt === "number" && now < u.beginAt)
    .sort((a, b) => a.beginAt - b.beginAt);
  const upcomingExamCount = upcoming.length;
  const upcomingExams = upcoming.slice(0, 4);
  const finishedExams = semuaUjian.filter((u) => u.endAt && now > u.endAt);

  const pendingTasks = [];
  if (finishedExams.length > 0 && canAccess("/admin/evaluasi")) {
    pendingTasks.push({
      id: "eval-reports",
      title: "Ujian Selesai (Membutuhkan Evaluasi & Rekap)",
      desc: `${finishedExams.length} ujian telah selesai dan siap dianalisis nilainya.`,
      count: finishedExams.length,
      route: "/admin/evaluasi",
      icon: <ShieldCheck className="h-5 w-5 text-amber-600 dark:text-amber-400" />
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

      {/* 1. TOP OPERATIONAL STATUS BAR (Z-Pattern Zone 1 - Anti-AI Slop: Clean, Functional, Semantic) */}
      <section className="rounded-2xl bg-slate-900 text-white p-6 sm:p-8 shadow-md border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700">
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${activeExams.length > 0 ? "bg-emerald-400" : "bg-slate-400"}`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${activeExams.length > 0 ? "bg-emerald-500" : "bg-slate-400"}`}></span>
              </span>
              {activeExams.length > 0
                ? `${activeExams.length} Ujian Sedang Berlangsung`
                : "Sistem CBT Siaga Operasional"}
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Pusat Kendali CBT Administrasi
            </h1>
            <p className="text-sm text-slate-400 max-w-xl">
              Selamat datang kembali, <span className="text-slate-200 font-medium">{user.namaLengkap}</span>. Ringkasan performa dan pengawasan ujian kampus tersedia seketika.
            </p>
          </div>

          {/* Quick Primary Actions */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {canAccess("/admin/ujian") && (
              <Button size="lg" className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl shadow border border-emerald-500/30" asChild>
                <Link to="/admin/ujian">
                  <Plus className="mr-2 h-4 w-4 stroke-[2.5]" />
                  Buat Ujian Baru
                </Link>
              </Button>
            )}
            {canAccess("/admin/peserta/online") && (
              <Button size="lg" variant="outline" className="bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 font-medium rounded-xl" asChild>
                <Link to="/admin/peserta/online">
                  <Radio className="mr-2 h-4 w-4 text-emerald-400" />
                  Pantau Peserta
                </Link>
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* 2. EXECUTIVE KPI CARDS GRID (Ruthless Data-Ink & High Contrast) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <KpiCard
          label="Total Peserta"
          value={formatNumber(counts.peserta)}
          subtitle="Mahasiswa terdaftar"
          icon={<Users className="h-5 w-5 text-blue-500" />}
          trend={newPeserta > 0 ? `+${newPeserta} baru` : null}
          trendPositive={true}
        />
        <KpiCard
          label="Total Ujian"
          value={formatNumber(counts.ujian)}
          subtitle={`${activeExams.length} Aktif • ${upcomingExamCount} Mendatang`}
          icon={<MonitorPlay className="h-5 w-5 text-emerald-500" />}
          trend={newUjian > 0 ? `+${newUjian} minggu ini` : null}
          trendPositive={true}
        />
        <KpiCard
          label="Bank Soal"
          value={formatNumber(counts.soal)}
          subtitle="Soal siap ujikan"
          icon={<FileText className="h-5 w-5 text-amber-500" />}
          trend={newSoal > 0 ? `+${newSoal} baru` : null}
          trendPositive={true}
        />
        <KpiCard
          label="Total Sesi Ujian"
          value={formatNumber(counts.sesi)}
          subtitle={`${counts.modul} Modul Mata Kuliah`}
          icon={<Layers className="h-5 w-5 text-purple-500" />}
        />
      </section>

      {/* 3. MAIN DASHBOARD CONTENT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">

        {/* LEFT COLUMN: Main Workflows (8 Cols) */}
        <div className="lg:col-span-8 space-y-6">

          {/* Live Surveillance Panel */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm p-6">
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50">
                  <Activity className="h-5 w-5 stroke-[2.5]" />
                </div>
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">Pengawasan Ujian Live</h2>
                  <p className="text-xs text-slate-500">Monitoring real-time kestabilan dan peserta ujian yang berlangsung</p>
                </div>
              </div>
              {activeExams.length > 0 && (
                <span className="px-3 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  {activeExams.length} Berlangsung
                </span>
              )}
            </div>

            {activeExams.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 p-6">
                <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                </div>
                <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-1">Tidak Ada Ujian Aktif Saat Ini</h3>
                <p className={`text-xs text-slate-500 max-w-md ${canAccess("/admin/ujian") ? "mb-5" : ""}`}>
                  Sistem dalam kondisi siaga penuh. Anda dapat mengecek ujian mendatang atau menyiapkan bank soal baru.
                </p>
                {canAccess("/admin/ujian") && (
                  <Button variant="outline" size="sm" className="rounded-xl border-slate-300 font-medium" asChild>
                    <Link to="/admin/ujian">Lihat Semua Jadwal Ujian</Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {activeExams.map((exam) => (
                  <div key={exam.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 hover:border-emerald-500/50 transition-all">
                    <div className="flex items-center gap-4 mb-3 sm:mb-0">
                      <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <Radio className="h-5 w-5 animate-pulse" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">{exam.nama}</h3>
                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                          <Clock className="h-3.5 w-3.5" />
                          <span>Berakhir pukul {new Date(exam.endAt as number).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })} WIB</span>
                        </div>
                      </div>
                    </div>
                    {canAccess("/admin/peserta/online") && (
                      <Button size="sm" className="bg-slate-900 hover:bg-slate-800 text-white rounded-lg px-4" asChild>
                        <Link to="/admin/peserta/online">
                          Pantau Peserta <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Operational Shortcuts Console */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm p-6">
            <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4">Konsol Aksi Cepat Administrasi</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {canAccess("/admin/ujian") && (
                <>
                  <ShortcutCard
                    title="Buat Ujian"
                    desc="Atur jadwal & durasi"
                    icon={<Plus className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
                    href="/admin/ujian"
                  />
                  <ShortcutCard
                    title="Rilis Token"
                    desc="Generate token sesi"
                    icon={<Key className="h-5 w-5 text-amber-600 dark:text-amber-400" />}
                    href="/admin/ujian"
                  />
                </>
              )}
              {canAccess("/admin/modul") && (
                <ShortcutCard
                  title="Bank Soal"
                  desc="Kelola & import soal"
                  icon={<BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
                  href="/admin/modul"
                />
              )}
              {canAccess("/admin/peserta/kartu") && (
                <ShortcutCard
                  title="Kartu Peserta"
                  desc="Cetak / eksport kartu"
                  icon={<Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />}
                  href="/admin/peserta/kartu"
                />
              )}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Urgent Tasks & Schedule (4 Cols) */}
        <div className="lg:col-span-4 space-y-6">

          {/* Urgent Action / Pending Tasks Queue */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm p-6">
            <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Perlu Perhatian & Tindakan</h2>
            </div>

            {pendingTasks.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">Semua Antrean Selesai</p>
                  <p className="text-[11px] text-slate-500">Tidak ada tugas evaluasi tertunda saat ini.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingTasks.map((task) => (
                  <Link key={task.id} to={task.route} className="block p-4 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/50 hover:bg-amber-100/50 transition-all group">
                    <div className="flex justify-between items-start mb-2">
                      <div className="p-1.5 rounded-lg bg-white dark:bg-slate-800 shadow-sm">
                        {task.icon}
                      </div>
                      <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-amber-600 text-white">
                        {task.count} Pending
                      </span>
                    </div>
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm mb-1">{task.title}</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">{task.desc}</p>
                    <div className="inline-flex items-center text-xs font-semibold text-amber-700 dark:text-amber-400 group-hover:underline">
                      Proses Sekarang <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming Exams Timeline */}
          {upcomingExams.length > 0 && (
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-5 w-5 text-blue-500" />
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">Ujian Mendatang</h2>
                </div>
                <span className="text-xs font-semibold text-slate-400">{upcomingExamCount} Terjadwal</span>
              </div>

              <div className="space-y-3">
                {upcomingExams.map((exam) => (
                  <div key={exam.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-1">{exam.nama}</h3>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <Clock className="h-3 w-3" />
                      <span suppressHydrationWarning>
                        {new Date(exam.beginAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" })} • {new Date(exam.beginAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* System Environment Telemetry */}
          <div className="rounded-2xl bg-slate-900 text-white border border-slate-800 p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-2">
                <Database className="h-3.5 w-3.5 text-blue-400" /> Database
              </span>
              <span className="text-xs font-medium text-slate-200">SQLite Local</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-2">
                <Server className="h-3.5 w-3.5 text-purple-400" /> ORM Engine
              </span>
              <span className="text-xs font-medium text-slate-200">Prisma Client</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-emerald-400" /> Versi Sistem
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-emerald-400">v1.2.0</span>
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
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
        <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
          {icon}
        </div>
      </div>

      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">{value}</span>
        {trend && (
          <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full ${
            trendPositive
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
              : "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400"
          }`}>
            <TrendingUp className="mr-1 h-3 w-3 inline" />
            {trend}
          </span>
        )}
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
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
    <Link to={href} className="flex flex-col p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 transition-all group">
      <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 shadow-sm w-fit mb-2 group-hover:scale-105 transition-transform">
        {icon}
      </div>
      <h3 className="text-xs font-bold text-slate-900 dark:text-white leading-tight mb-0.5">{title}</h3>
      <p className="text-[11px] text-slate-500 line-clamp-1">{desc}</p>
    </Link>
  );
}
