/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { sesiRepo, ujianRepo, soalRepo, mataKuliahRepo } from "@/lib/cbt/repos";
import { useAuthStore } from "@/lib/cbt/auth-store";
import { visibleUjians } from "@/lib/cbt/access";
import { AdminPage, AdminPageHeader } from "@/components/cbt/AdminPage";
import { ClipboardCheck, Calendar, BookOpen, ChevronRight, CheckCircle2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

import { hydrateRepos } from "@/lib/cbt/repos";

export const Route = createFileRoute("/_authenticated/admin/evaluasi/")({
  loader: async () => {
    try {
      await hydrateRepos();
    } catch (e) {
      console.error(e);
    }
  },
  component: EvaluasiList,
});

function formatDate(ts?: number) {
  if (!ts) return "Belum diatur";
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: "Asia/Jakarta" }).format(new Date(ts));
}

function EvaluasiList() {
  const user = useAuthStore((s) => s.user);
  const [search, setSearch] = useState("");

  const visibleIds = new Set(visibleUjians(user).map((u) => u.id));
  const sesis = sesiRepo.all().filter((s) => s.status === "selesai" && visibleIds.has(s.ujianId));
  const ujians = ujianRepo.all();
  const soals = soalRepo.all();
  const mks = mataKuliahRepo.all();
  const items = (() => {
    const soalSet = new Set(soals.filter((s) => s.tipe === "essay").map((s) => s.id));
    const ujianMap = new Map<string, { ujian: any, mk: any, totalSesi: number, belumSesi: number, totalEssay: number, belumEssay: number }>();

    sesis.forEach(s => {
      const essays = s.jawaban.filter((j) => soalSet.has(j.soalId));
      if (essays.length === 0) return;

      const belumCount = essays.filter((j) => typeof j.skor !== "number").length;
      
      if (!ujianMap.has(s.ujianId)) {
        const u = ujians.find(x => x.id === s.ujianId);
        if (!u) return;
        const mk = mks.find(m => m.id === u.mataKuliahId);
        ujianMap.set(s.ujianId, { ujian: u, mk, totalSesi: 0, belumSesi: 0, totalEssay: 0, belumEssay: 0 });
      }
      
      const entry = ujianMap.get(s.ujianId)!;
      entry.totalSesi += 1;
      entry.totalEssay += essays.length;
      entry.belumEssay += belumCount;
      if (belumCount > 0) {
        entry.belumSesi += 1;
      }
    });

    return Array.from(ujianMap.values())
      .filter((i) => 
        i.ujian.nama.toLowerCase().includes(search.toLowerCase()) || 
        (i.mk?.nama || "").toLowerCase().includes(search.toLowerCase())
      )
      .sort((a, b) => b.belumSesi - a.belumSesi);
  })();

  const totalBelumSesi = items.reduce((acc, curr) => acc + curr.belumSesi, 0);
  const totalBelumEssay = items.reduce((acc, curr) => acc + curr.belumEssay, 0);

  return (
    <AdminPage className="">
      <AdminPageHeader
        title="Penilaian Essay"
        description="Pilih ujian untuk mulai memeriksa dan memberikan nilai pada jawaban essay."
        action={
          totalBelumEssay > 0 ? (
            <div className="flex items-center gap-8 text-sm">
              <div className="flex flex-col items-end">
                <span className="text-label font-medium text-muted-foreground mb-0.5">Butuh Penilaian</span>
                <span className="text-xl font-medium text-foreground tabular-nums leading-none">
                  {items.filter(i => i.belumSesi > 0).length} <span className="text-sm text-muted-foreground font-medium ml-1">Ujian</span>
                </span>
              </div>
              <div className="w-px h-8 bg-muted" />
              <div className="flex flex-col items-end">
                <span className="text-label font-medium text-muted-foreground mb-0.5">Belum Dinilai</span>
                <span className="text-xl font-medium text-warn tabular-nums leading-none">
                  {totalBelumEssay} <span className="text-sm text-warn font-medium ml-1">Jawaban</span>
                </span>
              </div>
            </div>
          ) : undefined
        }
      />

      {/* Filter / Search Bar */}
      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Cari nama ujian atau mata kuliah..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-card border-border"
        />
      </div>

      {/* Data List (Concentric Borders Math & Advanced Soft Shadow) */}
      <div className="p-1.5 rounded-lg border border-border bg-card">
        <div className="rounded-lg overflow-hidden bg-card flex flex-col">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-border bg-muted/50 text-label font-semibold text-muted-foreground">
            <div className="col-span-12 sm:col-span-5">Daftar Ujian</div>
            <div className="hidden sm:block sm:col-span-2">Mata Kuliah</div>
            <div className="hidden sm:block sm:col-span-3">Progres Penilaian</div>
            <div className="hidden sm:block sm:col-span-2 text-right">Aksi</div>
          </div>

          {items.length === 0 ? (
            <div className="py-24 text-center flex flex-col items-center">
              {search ? (
                <>
                  <Search className="h-10 w-10 text-muted-foreground mb-3" />
                  <span className="text-foreground font-semibold">Pencarian Tidak Ditemukan</span>
                  <span className="text-sm text-muted-foreground mt-1">Coba kata kunci lain.</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-10 w-10 text-primary mb-3 opacity-80" />
                  <span className="text-foreground font-semibold">Semua Essay Telah Dinilai</span>
                  <span className="text-sm text-muted-foreground mt-1">Tidak ada jawaban essay yang menunggu penilaian.</span>
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {items.map(({ ujian, mk, totalSesi, belumSesi, totalEssay, belumEssay }) => {
                const isWarning = belumSesi > 0;
                const gradedEssay = totalEssay - belumEssay;
                const progressPct = totalEssay > 0 ? (gradedEssay / totalEssay) * 100 : 100;

                return (
                  <Link 
                    key={ujian.id} 
                    to="/admin/evaluasi/ujian/$id" 
                    params={{ id: ujian.id }}
                    className="group block transition-all duration-300 ease-spring hover:bg-accent cursor-pointer"
                  >
                    <div className="grid grid-cols-12 gap-4 px-6 py-4 items-center">
                      
                      {/* Col 1: Exam Info */}
                      <div className="col-span-12 sm:col-span-5 flex items-center gap-3.5">
                        <div className="flex items-center justify-center h-10 w-10 shrink-0 rounded-[10px] bg-muted border border-border group-hover:bg-primary/10 group-hover:border-primary/20 transition-all duration-300 ease-spring">
                          <ClipboardCheck className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-all duration-300 ease-spring" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-sm text-foreground truncate group-hover:text-primary transition-colors duration-300 ease-spring">
                            {ujian.nama}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-label text-muted-foreground">
                            <span className="font-mono">{ujian.id.substring(0, 8)}</span>
                            <span className="text-muted-foreground">•</span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 translate-y-[-0.5px]" /> {formatDate(ujian.beginAt)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Col 2: Subject Context */}
                      <div className="hidden sm:flex sm:col-span-2 items-center">
                        {mk ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted text-label font-semibold text-muted-foreground truncate max-w-full">
                            <BookOpen className="h-3 w-3 shrink-0 translate-y-[-0.5px]" />
                            <span className="truncate">{mk.nama}</span>
                          </span>
                        ) : (
                          <span className="text-label text-muted-foreground">Tanpa mata kuliah</span>
                        )}
                      </div>

                      {/* Col 3: Grading Progress */}
                      <div className="hidden sm:flex sm:col-span-3 flex-col justify-center">
                        <div className="flex items-center justify-between text-label font-medium text-muted-foreground mb-1.5 tabular-nums">
                          <span>{gradedEssay} / {totalEssay} dinilai</span>
                          <span className="text-foreground">{Math.round(progressPct)}%</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all duration-500 ease-out bg-primary"
                            style={{ width: `${progressPct}%` }} 
                          />
                        </div>
                      </div>

                      {/* Col 4: Status & Action */}
                      <div className="hidden sm:flex sm:col-span-2 items-center justify-end gap-4">
                        {isWarning ? (
                          <div className="flex items-center gap-1.5 text-label font-semibold text-warn bg-warn/10 border border-warn/30 px-2.5 py-1 rounded-md">
                            Perlu Dinilai
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-label font-semibold text-primary bg-primary/10 border border-primary/30 px-2.5 py-1 rounded-md">
                            Selesai
                          </div>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-muted-foreground transition-all duration-300 ease-spring shrink-0" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AdminPage>
  );
}
