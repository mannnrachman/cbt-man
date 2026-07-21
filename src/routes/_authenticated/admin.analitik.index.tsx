/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link } from "@tanstack/react-router";
import { sesiRepo, mataKuliahRepo, semesterRepo, usersRepo, ujianRepo } from "@/lib/cbt/repos";
import { Card, CardContent } from "@/components/ui/card";
import { useAuthStore } from "@/lib/cbt/auth-store";
import { visibleUjians } from "@/lib/cbt/access";
import { BookOpen, Users, CheckCircle2, TrendingUp, BarChart3, FileText, GraduationCap } from "lucide-react";
import { AdminPage, AdminPageHeader } from "@/components/cbt/AdminPage";

export const Route = createFileRoute("/_authenticated/admin/analitik/")({
  component: AnalitikIndex,
});

function StatCard({ label, value, icon: Icon }: { label: string; value: number | string; icon: any }) {
  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
      <CardContent className="p-6 flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
        </div>
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Icon className="h-6 w-6 text-primary" />
        </div>
      </CardContent>
    </Card>
  );
}

export function AnalitikIndex() {
  const user = useAuthStore((s) => s.user);
  const ujians = visibleUjians(user);
  
  // High level stats
  const semuaUjian = ujianRepo.all();
  const semuaSesi = sesiRepo.all();
  const peserta = usersRepo.all().filter((u) => u.role === "mahasiswa");
  const totalSelesai = semuaSesi.filter((s) => s.status === "selesai").length;
  const totalSedang = semuaSesi.filter((s) => s.status === "sedang").length;

  return (
    <AdminPage className="max-w-6xl pb-20">
      <AdminPageHeader
        title="Analitik Ujian"
        description="Ringkasan aktivitas ujian, laporan hasil, dan peringkat kelas (leaderboard)."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Peserta" value={peserta.length} icon={GraduationCap} />
        <StatCard label="Total Ujian" value={semuaUjian.length} icon={FileText} />
        <StatCard label="Sesi Selesai" value={totalSelesai} icon={CheckCircle2} />
        <StatCard label="Sedang Ujian" value={totalSedang} icon={TrendingUp} />
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Pilih Paket Ujian</h2>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 overflow-hidden">
          <div className="flex flex-col divide-y divide-slate-200 dark:divide-slate-800">
            {ujians.map((u) => {
              const sesiLengkap = semuaSesi.filter((s) => s.ujianId === u.id && s.status === "selesai").length;
              const mk = u.mataKuliahId ? mataKuliahRepo.byId(u.mataKuliahId) : null;
              
              const skors = semuaSesi.filter(s => s.ujianId === u.id && s.status === "selesai" && s.skorTotal !== undefined).map(s => s.skorTotal!);
              const avg = skors.length > 0 ? Math.round(skors.reduce((a,b)=>a+b, 0) / skors.length) : 0;
              const maxSkor = u.poinBenar * (u.topicSets || []).reduce((a, b) => a + b.jumlah, 0);

              const progress = peserta.length > 0 ? Math.round((sesiLengkap / peserta.length) * 100) : 0;

              return (
                <div key={u.id} className="p-4 sm:p-6 hover:bg-white dark:hover:bg-slate-900 transition-colors group">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* Info Utama */}
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Link to="/admin/analitik/$id" params={{ id: u.id }} className="text-lg font-bold text-slate-900 dark:text-slate-100 group-hover:text-primary transition-colors">
                          {u.nama}
                        </Link>
                      </div>
                      {mk && (
                        <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                          <BookOpen className="h-3.5 w-3.5" />
                          {mk.nama}
                        </div>
                      )}
                    </div>

                    {/* Progres Selesai */}
                    <div className="w-32 sm:w-48 shrink-0">
                      <div className="flex justify-between text-xs mb-1.5 font-medium">
                        <span className="text-slate-600 dark:text-slate-300">{sesiLengkap} dari {peserta.length} selesai</span>
                        <span className="text-emerald-600 dark:text-emerald-400">{progress}%</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5">
                        <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
                      </div>
                    </div>

                    {/* Rata-rata Skor */}
                    <div className="w-24">
                      <div className="text-xs text-slate-500 mb-0.5">Rata-rata Skor</div>
                      <div className="font-bold text-lg text-primary">{avg} <span className="text-xs text-slate-400 font-normal">/ {maxSkor}</span></div>
                    </div>

                    {/* Action Button */}
                    <div className="shrink-0">
                      <Link to="/admin/analitik/$id" params={{ id: u.id }} className="flex items-center justify-center h-9 px-4 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20">
                        Buka Detail
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {ujians.length === 0 && (
              <div className="p-12 text-center text-sm text-slate-500">
                Belum ada data paket ujian.
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminPage>
  );
}
