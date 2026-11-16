
import { createFileRoute, Link } from "@tanstack/react-router";
import { sesiRepo, mataKuliahRepo, semesterRepo, usersRepo, ujianRepo } from "@/lib/cbt/repos";
import { Card, CardContent } from "@/components/ui/card";
import { useAuthStore } from "@/lib/cbt/auth-store";
import { AdminPage, AdminPageHeader } from "@/components/cbt/AdminPage";
import { visibleUjians } from "@/lib/cbt/access";
import { BookOpen, BarChart3, ChevronRight, Activity, Download, Target } from "lucide-react";


export const Route = createFileRoute("/_authenticated/admin/analitik/")({
  component: AnalitikIndex,
});


export function AnalitikIndex() {
  const user = useAuthStore((s) => s.user);
  const ujians = visibleUjians(user);
  
  // High level stats
  const semuaUjian = ujianRepo.all();
  const semuaSesi = sesiRepo.all();
  const peserta = usersRepo.all().filter((u) => u.role === "mahasiswa");
  const totalSelesai = semuaSesi.filter((s) => s.status === "selesai").length;

  return (
    <AdminPage className="">
      <AdminPageHeader
        title="Analisis & Hasil"
        description="Ringkasan aktivitas ujian, laporan hasil, dan peringkat kelas."
        action={
          <div className="flex items-center gap-8 text-sm">
            <div className="flex flex-col items-end">
              <span className="text-label font-medium text-muted-foreground mb-0.5">Total Ujian</span>
              <span className="text-xl font-medium text-foreground tabular-nums leading-none">
                {semuaUjian.length}
              </span>
            </div>
            <div className="w-px h-8 bg-muted" />
            <div className="flex flex-col items-end">
              <span className="text-label font-medium text-muted-foreground mb-0.5">Peserta Terdaftar</span>
              <span className="text-xl font-medium text-foreground tabular-nums leading-none">
                {peserta.length}
              </span>
            </div>
            <div className="w-px h-8 bg-muted" />
            <div className="flex flex-col items-end">
              <span className="text-label font-medium text-muted-foreground mb-0.5">Sesi Selesai</span>
              <span className="text-xl font-medium text-primary tabular-nums leading-none">
                {totalSelesai}
              </span>
            </div>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Link to="/admin/analitik/rekap">
          <div className="bg-card border border-border p-4 rounded-lg flex items-center gap-4 hover:border-primary/50 transition-all group cursor-pointer h-full">
            <div className="h-12 w-12 shrink-0 bg-primary/10 rounded-lg flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Download className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="font-semibold text-foreground group-hover:text-primary transition-colors">Rekap Global & Export</div>
              <div className="text-label text-muted-foreground mt-0.5">Filter dan ekspor semua nilai mahasiswa ke Excel berdasarkan tanggal atau prodi.</div>
            </div>
          </div>
        </Link>
        <Link to="/admin/analitik/analisis">
          <div className="bg-card border border-border p-4 rounded-lg flex items-center gap-4 hover:border-primary/50 transition-all group cursor-pointer h-full">
            <div className="h-12 w-12 shrink-0 bg-primary/10 rounded-lg flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Target className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="font-semibold text-foreground group-hover:text-primary transition-colors">Analisis Butir Soal</div>
              <div className="text-label text-muted-foreground mt-0.5">Laporan evaluasi Tingkat Kesukaran (TK) dan Daya Pembeda (DK) per soal.</div>
            </div>
          </div>
        </Link>
      </div>

      {/* Data List */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-border bg-muted/50 text-label font-semibold text-muted-foreground">
          <div className="col-span-12 sm:col-span-5">Dokumen Ujian</div>
          <div className="hidden sm:block sm:col-span-3">Tingkat Penyelesaian</div>
          <div className="hidden sm:block sm:col-span-2">Rata-rata Skor</div>
          <div className="hidden sm:block sm:col-span-2 text-right">Aksi</div>
        </div>

        {ujians.length === 0 ? (
          <div className="py-24 text-center flex flex-col items-center">
            <Activity className="h-10 w-10 text-muted-foreground mb-3" />
            <span className="text-foreground font-semibold">Belum Ada Ujian</span>
            <span className="text-sm text-muted-foreground mt-1">Buat paket ujian baru untuk melihat analisisnya di sini.</span>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border">

            {ujians.map((u) => {
              const sesiLengkap = semuaSesi.filter((s) => s.ujianId === u.id && s.status === "selesai").length;
              const mk = u.mataKuliahId ? mataKuliahRepo.byId(u.mataKuliahId) : null;
              
              const skors = semuaSesi.filter(s => s.ujianId === u.id && s.status === "selesai" && s.skorTotal !== undefined).map(s => s.skorTotal!);
              const avg = skors.length > 0 ? Math.round(skors.reduce((a,b)=>a+b, 0) / skors.length) : 0;
              const maxSkor = u.poinBenar * (u.topicSets || []).reduce((a, b) => a + b.jumlah, 0);

              const progress = peserta.length > 0 ? Math.round((sesiLengkap / peserta.length) * 100) : 0;

              return (
                <Link 
                  key={u.id} 
                  to="/admin/analitik/$id" 
                  params={{ id: u.id }}
                  className="group block transition-all duration-300 ease-spring hover:bg-muted cursor-pointer"
                >
                  <div className="grid grid-cols-12 gap-4 px-6 py-4 items-center">
                    
                    {/* Col 1: Exam Info */}
                    <div className="col-span-12 sm:col-span-5 flex items-start gap-3">
                      <div className="mt-0.5">
                        <BarChart3 className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors duration-300 ease-spring" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-sm text-foreground truncate group-hover:text-primary transition-colors duration-300 ease-spring">
                          {u.nama}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-label text-muted-foreground">
                          {mk ? (
                            <span className="flex items-center gap-1">
                              <BookOpen className="h-3 w-3" /> {mk.nama}
                            </span>
                          ) : (
                            <span className="">Tanpa mata kuliah</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Col 2: Progress */}
                    <div className="hidden sm:flex sm:col-span-3 flex-col justify-center">
                      <div className="flex items-center justify-between text-label font-medium text-muted-foreground mb-1.5 tabular-nums">
                        <span>{sesiLengkap} / {peserta.length} Selesai</span>
                        <span className="text-foreground">{progress}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ease-out ${progress === 100 ? 'bg-primary' : 'bg-primary'}`} 
                          style={{ width: `${progress}%` }} 
                        />
                      </div>
                    </div>

                    {/* Col 3: Average */}
                    <div className="hidden sm:flex sm:col-span-2 items-center">
                      <div className="font-medium text-sm tabular-nums text-foreground">
                        {avg} <span className="text-label text-muted-foreground font-normal">/ {maxSkor}</span>
                      </div>
                    </div>

                    {/* Col 4: Action */}
                    <div className="hidden sm:flex sm:col-span-2 items-center justify-end">
                      <div className="flex items-center gap-1.5 text-label font-semibold text-primary group-hover:text-primary/80 transition-colors">
                        Lihat Analisis <ChevronRight className="h-4 w-4 transition-all duration-300 ease-spring shrink-0" />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

      </div>
    </AdminPage>
  );
}
