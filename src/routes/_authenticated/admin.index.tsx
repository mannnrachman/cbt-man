import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuthStore } from "@/lib/cbt/auth-store";
import { useThemeStore } from "@/lib/cbt/theme-store";
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
  CheckCircle2,
  Database,
  Box,
  Cpu
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminPage, AdminPageHeader } from "@/components/cbt/AdminPage";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: CommandCenter,
});

function CommandCenter() {
  const user = useAuthStore((s) => s.user)!;
  const { theme } = useThemeStore();
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

  if (theme === "neobrutalism") {
        return (
        <div className="w-full space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
          
          {/* 1. HERO SECTION (Neobrutalism Style) */}
          <section className="relative overflow-hidden bg-[color:var(--neo-bg)] rounded-[2rem] p-8 sm:p-12 text-[color:var(--neo-text)]">
            {/* Background Sparkles / Stars (Matching Coursue Design) */}
            <div className="absolute top-0 right-0 bottom-0 w-1/2 overflow-hidden pointer-events-none hidden md:block">
              {/* Large Star */}
              <svg className="absolute top-8 right-16 w-[280px] h-[280px] text-[color:var(--neo-text)]/5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C12 0 12 10 24 12C24 12 12 14 12 24C12 24 12 14 0 12C0 12 12 10 12 0Z" />
              </svg>
              {/* Small Star */}
              <svg className="absolute bottom-16 right-[30%] w-24 h-24 text-[color:var(--neo-text)]/5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C12 0 12 10 24 12C24 12 12 14 12 24C12 24 12 14 0 12C0 12 12 10 12 0Z" />
              </svg>
            </div>
    
            <div className="relative z-10 max-w-2xl">
              <p className="text-[color:var(--neo-text)]/60 uppercase tracking-widest text-xs font-bold mb-3">
                DASHBOARD ADMINISTRASI
              </p>
              <h1 className="text-3xl md:text-5xl lg:text-[54px] font-medium leading-[1.1] mb-10 text-[color:var(--neo-text)]">
                Kelola Ujian Kampus Anda Secara Profesional
              </h1>
              
              <Button size="lg" className="rounded-full bg-black text-white hover:bg-gray-800 pl-8 pr-2 py-2 h-14 text-base font-medium flex items-center gap-4 border-0 w-fit" asChild>
                <Link to="/admin/ujian">
                  Jadwalkan Ujian
                  <div className="bg-white text-[color:var(--neo-text)] rounded-full w-10 h-10 flex items-center justify-center shrink-0">
                    <ArrowRight className="w-5 h-5 stroke-[3]" />
                  </div>
                </Link>
              </Button>
            </div>
          </section>
    
          {/* 2. STATS GRID (Neobrutalism Cards) */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            <StatCardNeo 
              icon={<Users className="h-6 w-6 stroke-[3]" />} 
              label="Total Peserta" 
              value={counts.peserta} 
              trend={newPeserta > 0 ? `+${newPeserta} baru` : null}
            />
            <StatCardNeo 
              icon={<FileText className="h-6 w-6 stroke-[3]" />} 
              label="Total Ujian" 
              value={counts.ujian} 
              trend={newUjian > 0 ? `+${newUjian} ujian` : null}
            />
            <StatCardNeo 
              icon={<BookOpen className="h-6 w-6 stroke-[3]" />} 
              label="Bank Soal" 
              value={counts.soal} 
              trend={newSoal > 0 ? `+${newSoal} soal` : null}
            />
            <StatCardNeo 
              icon={<Zap className="h-6 w-6 stroke-[3]" />} 
              label="Total Sesi" 
              value={counts.sesi} 
            />
          </section>
    
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* LEFT COLUMN: Main Workflows */}
            <div className="lg:col-span-8 space-y-8">
              
              {/* Live Exams Dashboard */}
              <section className="bg-white border-[length:var(--neo-border-width)] border-[color:var(--neo-border-color)] shadow-[var(--neo-shadow)] p-6 sm:p-8">
                <div className="flex items-center justify-between mb-8 pb-4 border-b-[length:var(--neo-border-width)] border-b-[color:var(--neo-border-color)]">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-[color:var(--neo-accent)] border-[length:var(--neo-border-width)] border-[color:var(--neo-border-color)] shadow-[var(--neo-shadow)]">
                      <MonitorPlay className="h-8 w-8 stroke-[3]" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black uppercase text-[color:var(--neo-text)] tracking-tight">Live Monitoring</h2>
                      <p className="text-sm font-bold text-[color:var(--neo-text)] mt-1">Pantau ujian yang sedang berlangsung secara real-time</p>
                    </div>
                  </div>
                  {activeExams.length > 0 && (
                    <div className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-[color:var(--neo-text)] bg-[color:var(--neo-bg)] px-4 py-2 border-[length:var(--neo-border-width)] border-[color:var(--neo-border-color)] shadow-[var(--neo-shadow)]">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full bg-black opacity-75"></span>
                        <span className="relative inline-flex h-3 w-3 bg-black"></span>
                      </span>
                      {activeExams.length} Aktif
                    </div>
                  )}
                </div>
    
                {activeExams.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center border-4 border-dashed border-black bg-[color:var(--neo-bg)]">
                    <div className="h-16 w-16 bg-white border-[length:var(--neo-border-width)] border-[color:var(--neo-border-color)] flex items-center justify-center text-[color:var(--neo-text)] mb-6 shadow-[var(--neo-shadow)]">
                      <PlayCircle className="h-8 w-8 stroke-[3]" />
                    </div>
                    <h3 className="text-xl font-black uppercase text-[color:var(--neo-text)] mb-3 bg-white px-4 py-1 border-[length:var(--neo-border-width)] border-[color:var(--neo-border-color)] shadow-[var(--neo-shadow)]">Sistem Siaga</h3>
                    <p className="text-sm font-bold text-[color:var(--neo-text)] max-w-sm mb-8 bg-white/70 p-3 border-[length:var(--neo-border-width)] border-[color:var(--neo-border-color)] shadow-[var(--neo-shadow)]">
                      Belum ada ujian yang berjalan saat ini. Anda dapat bersantai atau mulai menjadwalkan ujian berikutnya.
                    </p>
                    <Button className="font-black uppercase rounded-[var(--neo-radius)] border-[length:var(--neo-border-width)] border-[color:var(--neo-border-color)] bg-[color:var(--neo-accent)] text-[color:var(--neo-text)] shadow-[var(--neo-shadow)] hover:bg-white hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[var(--neo-shadow)] px-8 h-12" asChild>
                      <Link to="/admin/ujian">Buat Ujian Baru</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-6">
                    {activeExams.map((exam) => (
                      <div key={exam.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-white border-[length:var(--neo-border-width)] border-[color:var(--neo-border-color)] shadow-[var(--neo-shadow)] hover:bg-[color:var(--neo-bg)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[var(--neo-shadow)] transition-all duration-100">
                        <div className="flex items-center gap-5 mb-4 sm:mb-0">
                          <div className="flex h-14 w-14 items-center justify-center bg-[color:var(--neo-accent)] border-[length:var(--neo-border-width)] border-[color:var(--neo-border-color)] shadow-[var(--neo-shadow)]">
                            <Activity className="h-7 w-7 stroke-[3]" />
                          </div>
                          <div>
                            <h3 className="text-xl font-black uppercase text-[color:var(--neo-text)] mb-2">{exam.nama}</h3>
                            <div className="flex items-center gap-3 text-sm font-bold text-[color:var(--neo-text)] bg-white px-3 py-1.5 border-[length:var(--neo-border-width)] border-[color:var(--neo-border-color)] inline-flex shadow-[var(--neo-shadow)]">
                              <Clock className="h-5 w-5 stroke-[3]" /> Berakhir {new Date(exam.endAt!).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })}
                            </div>
                          </div>
                        </div>
                        <Button className="w-full sm:w-auto font-black uppercase bg-black text-white rounded-[var(--neo-radius)] border-[length:var(--neo-border-width)] border-[color:var(--neo-border-color)] shadow-[var(--neo-shadow)] hover:bg-white hover:text-[color:var(--neo-text)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[var(--neo-shadow)] transition-all h-12 px-6" asChild>
                          <Link to="/admin/peserta/online">
                            Pantau Peserta <ArrowRight className="ml-3 h-5 w-5 stroke-[3]" />
                          </Link>
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
    
            </div>
    
            {/* RIGHT COLUMN: Secondary Workflows & Info */}
            <div className="lg:col-span-4 space-y-8">
              
              {/* Action Required */}
              <section className="bg-white border-[length:var(--neo-border-width)] border-[color:var(--neo-border-color)] shadow-[var(--neo-shadow)] p-6 sm:p-8">
                <div className="flex items-center gap-4 mb-6 pb-4 border-b-[length:var(--neo-border-width)] border-b-[color:var(--neo-border-color)]">
                  <div className="p-2 bg-[color:var(--neo-bg)] border-[length:var(--neo-border-width)] border-[color:var(--neo-border-color)] shadow-[var(--neo-shadow)]">
                    <AlertCircle className="h-6 w-6 stroke-[3]" />
                  </div>
                  <h2 className="text-xl font-black uppercase text-[color:var(--neo-text)] tracking-tight">Perlu Perhatian</h2>
                </div>
    
                {pendingTasks.length === 0 ? (
                  <div className="flex items-start gap-4 p-5 bg-[color:var(--neo-accent)] border-[length:var(--neo-border-width)] border-[color:var(--neo-border-color)] shadow-[var(--neo-shadow)]">
                    <div className="bg-white border-[length:var(--neo-border-width)] border-[color:var(--neo-border-color)] p-2 shadow-[var(--neo-shadow)]">
                      <CheckCircle2 className="h-6 w-6 stroke-[3] text-[color:var(--neo-text)]" />
                    </div>
                    <div>
                      <p className="text-lg font-black uppercase text-[color:var(--neo-text)]">Semua Terkendali</p>
                      <p className="text-sm font-bold text-[color:var(--neo-text)] mt-1">Tidak ada tugas yang tertunda.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {pendingTasks.map((task) => (
                      <Link key={task.id} to={task.route} className="flex flex-col p-5 bg-[color:var(--neo-bg)] border-[length:var(--neo-border-width)] border-[color:var(--neo-border-color)] shadow-[var(--neo-shadow)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[var(--neo-shadow)] transition-all group">
                        <div className="flex justify-between items-start mb-5">
                          <div className="bg-white border-[length:var(--neo-border-width)] border-[color:var(--neo-border-color)] p-2 shadow-[var(--neo-shadow)] text-[color:var(--neo-text)]">
                            {task.icon}
                          </div>
                          <div className="bg-black text-white text-xs font-black uppercase tracking-wider px-3 py-1.5 shadow-[var(--neo-shadow)] border-2 border-white">
                            {task.count} antrean
                          </div>
                        </div>
                        <h3 className="font-black uppercase text-[color:var(--neo-text)] text-xl mb-3">{task.title}</h3>
                        <p className="text-sm font-bold text-[color:var(--neo-text)] flex items-center bg-white px-3 py-1.5 border-[length:var(--neo-border-width)] border-[color:var(--neo-border-color)] inline-flex shadow-[var(--neo-shadow)] w-fit group-hover:bg-[color:var(--neo-accent)]">
                          Selesaikan sekarang <ArrowRight className="ml-2 h-5 w-5 stroke-[3]" />
                        </p>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
    
              {/* Upcoming Schedule */}
              {upcomingExams.length > 0 && (
                <section className="bg-white border-[length:var(--neo-border-width)] border-[color:var(--neo-border-color)] shadow-[var(--neo-shadow)] p-6 sm:p-8">
                  <div className="flex items-center gap-4 mb-6 pb-4 border-b-[length:var(--neo-border-width)] border-b-[color:var(--neo-border-color)]">
                    <div className="p-2 bg-[color:var(--neo-bg)] border-[length:var(--neo-border-width)] border-[color:var(--neo-border-color)] shadow-[var(--neo-shadow)]">
                      <CalendarClock className="h-6 w-6 stroke-[3]" />
                    </div>
                    <h2 className="text-xl font-black uppercase text-[color:var(--neo-text)] tracking-tight">Ujian Mendatang</h2>
                  </div>
                  
                  <div className="relative">
                    {/* Timeline line */}
                    <div className="absolute left-[24px] top-4 bottom-4 w-1.5 bg-black"></div>
                    
                    <div className="space-y-8 relative">
                      {upcomingExams.map((exam) => (
                        <div key={exam.id} className="flex gap-6 group cursor-default">
                          <div className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center bg-[color:var(--neo-accent)] border-[length:var(--neo-border-width)] border-[color:var(--neo-border-color)] shadow-[var(--neo-shadow)]">
                            <div className="h-4 w-4 bg-black group-hover:scale-150 transition-transform duration-300"></div>
                          </div>
                          <div className="pt-1 pb-2">
                            <h3 className="text-base font-black uppercase text-[color:var(--neo-text)] leading-none mb-3 bg-white px-2 py-1 border-[length:var(--neo-border-width)] border-[color:var(--neo-border-color)] shadow-[var(--neo-shadow)] inline-block">{exam.nama}</h3>
                            <p className="text-xs font-bold text-[color:var(--neo-text)] bg-[color:var(--neo-bg)] px-3 py-1.5 border-[length:var(--neo-border-width)] border-[color:var(--neo-border-color)] shadow-[var(--neo-shadow)] flex items-center gap-2 w-fit">
                              <Clock className="h-4 w-4 stroke-[3]" /> 
                              <span suppressHydrationWarning>{new Date(exam.beginAt!).toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" })} • {new Date(exam.beginAt!).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })}</span>
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )}
    
              {/* System Info */}
              <section className="bg-[color:var(--neo-bg)] border-[length:var(--neo-border-width)] border-[color:var(--neo-border-color)] shadow-[var(--neo-shadow)] p-6 sm:p-8">
                <h2 className="text-lg font-black uppercase tracking-wider text-[color:var(--neo-text)] mb-6 border-b-[length:var(--neo-border-width)] border-b-[color:var(--neo-border-color)] pb-3">
                  Informasi Sistem
                </h2>
                <div className="space-y-5 text-sm font-bold">
                  <div className="flex justify-between items-center border-b-[length:var(--neo-border-width)] border-b-[color:var(--neo-border-color)] pb-4 border-dashed">
                    <span className="text-[color:var(--neo-text)] uppercase">Database</span>
                    <span className="text-[color:var(--neo-text)] bg-white px-3 py-1 border-[length:var(--neo-border-width)] border-[color:var(--neo-border-color)] shadow-[var(--neo-shadow)] flex items-center gap-2">
                      <div className="h-3 w-3 bg-[color:var(--neo-accent)] border-[length:var(--neo-border-width)] border-[color:var(--neo-border-color)]"></div> SQLite Local
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-b-[length:var(--neo-border-width)] border-b-[color:var(--neo-border-color)] pb-4 border-dashed">
                    <span className="text-[color:var(--neo-text)] uppercase">Engine</span>
                    <span className="text-[color:var(--neo-text)] bg-white px-3 py-1 border-[length:var(--neo-border-width)] border-[color:var(--neo-border-color)] shadow-[var(--neo-shadow)]">Prisma ORM</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[color:var(--neo-text)] uppercase">Version</span>
                    <span className="text-[color:var(--neo-text)] bg-white px-3 py-1 border-[length:var(--neo-border-width)] border-[color:var(--neo-border-color)] shadow-[var(--neo-shadow)]">v1.2.0</span>
                  </div>
                </div>
              </section>
    
            </div>
          </div>
        </div>
      );
  }

  const pendingTasksClean = finishedExams.length > 0 ? [{
      id: "eval-reports",
      title: "Ujian Selesai (Butuh Evaluasi)",
      count: finishedExams.length,
      route: "/admin/evaluasi",
      icon: <ShieldCheck className="h-4 w-4" />
  }] : [];

    return (
      <AdminPage className="pb-20">
        
        {/* 1. HEADER */}
        <AdminPageHeader
          title="Dashboard Administrasi"
          description="Kelola ujian, evaluasi hasil, dan pantau aktivitas peserta secara real-time."
          action={
            <Button size="sm" asChild>
              <Link to="/admin/ujian">
                <Plus className="h-4 w-4 mr-2" />
                Buat Ujian Baru
              </Link>
            </Button>
          }
        />
  
        {/* 2. STATS GRID */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCardClean 
            icon={<Users className="h-4 w-4" />} 
            label="Total Peserta" 
            value={counts.peserta} 
            trend={newPeserta > 0 ? `+${newPeserta} minggu ini` : null}
          />
          <StatCardClean 
            icon={<FileText className="h-4 w-4" />} 
            label="Total Ujian" 
            value={counts.ujian} 
            trend={newUjian > 0 ? `+${newUjian} minggu ini` : null}
          />
          <StatCardClean 
            icon={<BookOpen className="h-4 w-4" />} 
            label="Bank Soal" 
            value={counts.soal} 
            trend={newSoal > 0 ? `+${newSoal} minggu ini` : null}
          />
          <StatCardClean 
            icon={<Zap className="h-4 w-4" />} 
            label="Total Sesi" 
            value={counts.sesi} 
          />
        </div>
  
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LEFT COLUMN: Main Workflows (Live Exams) */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="space-y-1">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <MonitorPlay className="h-5 w-5 text-primary" />
                    Live Monitoring
                  </CardTitle>
                  <CardDescription>Pantau ujian yang sedang berlangsung secara real-time</CardDescription>
                </div>
                {activeExams.length > 0 && (
                  <Badge variant="secondary" className="bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400">
                    <span className="relative flex h-2 w-2 mr-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    {activeExams.length} Aktif
                  </Badge>
                )}
              </CardHeader>
              <CardContent>
                {activeExams.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                      <PlayCircle className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <h3 className="text-sm font-medium text-foreground mb-1">Sistem Siaga</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mb-6">
                      Belum ada ujian yang berjalan saat ini. Anda dapat bersantai atau mulai menjadwalkan ujian berikutnya.
                    </p>
                    <Button variant="outline" asChild>
                      <Link to="/admin/ujian">Lihat Jadwal Ujian</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-4 mt-4">
                    {activeExams.map((exam) => (
                      <div key={exam.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-border bg-muted/30 transition-colors hover:bg-muted/50">
                        <div className="flex items-start gap-4 mb-4 sm:mb-0">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background border border-border shadow-sm">
                            <Activity className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-foreground mb-1">{exam.nama}</h3>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Clock className="h-3.5 w-3.5" /> Berakhir {new Date(exam.endAt!).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })}
                            </div>
                          </div>
                        </div>
                        <Button size="sm" className="w-full sm:w-auto" asChild>
                          <Link to="/admin/peserta/online">
                            Pantau Peserta <ArrowRight className="ml-2 h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
  
          {/* RIGHT COLUMN: Secondary Workflows & Info */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Action Required */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  Perlu Perhatian
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pendingTasksClean.length === 0 ? (
                  <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/30">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Semua Terkendali</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Tidak ada tugas yang tertunda.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingTasksClean.map((task) => (
                      <Link key={task.id} to={task.route} className="flex flex-col p-3 rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors group">
                        <div className="flex justify-between items-start mb-2">
                          <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                            {task.icon}
                          </div>
                          <Badge variant="secondary" className="font-medium">
                            {task.count} antrean
                          </Badge>
                        </div>
                        <h3 className="font-medium text-sm text-foreground mb-1">{task.title}</h3>
                        <p className="text-xs text-primary font-medium flex items-center group-hover:underline">
                          Selesaikan sekarang <ArrowRight className="ml-1 h-3.5 w-3.5" />
                        </p>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
  
            {/* Upcoming Schedule */}
            {upcomingExams.length > 0 && (
              <Card className="shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-primary" />
                    Jadwal Mendatang
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative pl-5 border-l border-border/60 ml-2 space-y-6">
                    {upcomingExams.map((exam) => (
                      <div key={exam.id} className="relative">
                        <div className="absolute -left-[25px] top-1 h-2 w-2 rounded-full border-2 border-primary bg-background"></div>
                        <div className="flex flex-col">
                          <h3 className="text-sm font-medium text-foreground mb-1 line-clamp-1">{exam.nama}</h3>
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Clock className="h-3 w-3" /> 
                            <span suppressHydrationWarning>{new Date(exam.beginAt!).toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" })} • {new Date(exam.beginAt!).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })}</span>
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
  
            {/* System Info */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-muted-foreground" />
                  Informasi Sistem
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-1 border-b border-border border-dashed last:border-0">
                    <span className="text-xs text-muted-foreground font-medium flex items-center gap-2">
                      <Database className="h-3.5 w-3.5" /> Database
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono shadow-none">SQLite Local</Badge>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-border border-dashed last:border-0">
                    <span className="text-xs text-muted-foreground font-medium flex items-center gap-2">
                      <Box className="h-3.5 w-3.5" /> Engine
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono shadow-none">Prisma ORM</Badge>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-border border-dashed last:border-0">
                    <span className="text-xs text-muted-foreground font-medium flex items-center gap-2">
                      <Zap className="h-3.5 w-3.5" /> Version
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono shadow-none">v1.2.0</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
  
          </div>
        </div>
      </AdminPage>
    );
}

function StatCardNeo({ icon, label, value, trend }: { icon: React.ReactNode, label: string, value: number, trend?: string | null }) {
  return (
    <div className="bg-white p-5 sm:p-6 border-[length:var(--neo-border-width)] border-[color:var(--neo-border-color)] shadow-[var(--neo-shadow)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[var(--neo-shadow)] transition-all duration-100 flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-6">
        <h3 className="text-xs font-black uppercase tracking-wider text-[color:var(--neo-text)] bg-[color:var(--neo-bg)] px-3 py-1.5 border-[length:var(--neo-border-width)] border-[color:var(--neo-border-color)] shadow-[var(--neo-shadow)] text-center">{label}</h3>
        <div className="text-[color:var(--neo-text)] bg-[color:var(--neo-accent)] p-2 border-[length:var(--neo-border-width)] border-[color:var(--neo-border-color)] shadow-[var(--neo-shadow)]">
          {icon}
        </div>
      </div>
      <div>
        <div className="flex items-end gap-3 mt-4">
          <span className="text-4xl md:text-5xl font-black text-[color:var(--neo-text)] tracking-tight">{value}</span>
          {trend && (
            <span className="text-xs font-black text-[color:var(--neo-text)] bg-[color:var(--neo-accent)] px-2 py-1 border-[length:var(--neo-border-width)] border-[color:var(--neo-border-color)] shadow-[var(--neo-shadow)] mb-2 inline-block">
              {trend}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCardClean({ icon, label, value, trend }: { icon: React.ReactNode, label: string, value: number, trend?: string | null }) {
  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 pt-4 sm:px-6 sm:pt-6">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <div className="text-muted-foreground">
          {icon}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
        <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">{value}</div>
        {trend && (
          <p className="text-xs text-muted-foreground mt-1 font-medium">
            {trend}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
