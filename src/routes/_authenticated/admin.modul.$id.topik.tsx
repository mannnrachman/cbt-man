import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { modulRepo, topikRepo, soalRepo } from "@/lib/cbt/repos";
import { uid } from "@/lib/cbt/storage";
import type { Topik } from "@/lib/cbt/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, ChevronRight, Lock, BookOpen, Layers } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/cbt/auth-store";
import { allowedTopikIdSet, isUnrestricted } from "@/lib/cbt/access";

export const Route = createFileRoute("/_authenticated/admin/modul/$id/topik")({
  component: TopikPage,
});

function TopikPage() {
  const { id: modulId } = useParams({ from: "/_authenticated/admin/modul/$id/topik" });
  const user = useAuthStore((s) => s.user);
  const canEdit = isUnrestricted(user);
  const allowedSet = allowedTopikIdSet(user);
  const modul = modulRepo.byId(modulId);
  const filterMine = (list: Topik[]) =>
    list.filter((t) => t.modulId === modulId && (!allowedSet || allowedSet.has(t.id)));
  const [topiks, setTopiks] = useState<Topik[]>(filterMine(topikRepo.all()));
  const [nama, setNama] = useState("");

  if (!modul) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <p className="text-slate-500 mb-4">Modul tidak ditemukan.</p>
      <Button asChild variant="outline"><Link to="/admin/modul">Kembali ke Bank Soal</Link></Button>
    </div>
  );

  function add() {
    if (!canEdit) return;
    if (!nama.trim()) return;
    topikRepo.upsert({ id: uid("t_"), modulId, nama: nama.trim() });
    setNama(""); setTopiks(filterMine(topikRepo.all())); toast.success("Topik ditambahkan");
  }
  function remove(id: string) {
    if (!canEdit) return;
    if (soalRepo.all().some((s) => s.topikId === id)) { toast.error("Hapus soal di topik ini dulu"); return; }
    if (!confirm("Hapus topik?")) return;
    topikRepo.remove(id); setTopiks(filterMine(topikRepo.all()));
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 animate-in fade-in duration-500 pb-12 pt-4">
      {/* Header Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end justify-between border-b border-slate-200 dark:border-white/10 pb-6">
        <div className="space-y-1">
          <Link to="/admin/modul" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 w-fit mb-3">
            ← Kembali ke Bank Soal
          </Link>
          <div className="flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-slate-400" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{modul.nama}</h1>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Kelola topik/bab untuk modul ini. Setiap topik dapat berisi puluhan hingga ratusan soal.
          </p>
        </div>
      </div>

      {/* Creation Row */}
      {canEdit ? (
        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center gap-3">
          <Input 
            placeholder="Ketik nama topik baru (misal: Bab 1: Pengantar)" 
            value={nama} 
            onChange={(e) => setNama(e.target.value)} 
            className="flex-1 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
          />
          <Button onClick={add} className="w-full sm:w-auto font-semibold">
            <Plus className="mr-2 h-4 w-4" />Tambah Topik
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200/50 bg-amber-50/50 dark:bg-amber-950/20 p-4 text-sm text-amber-700 dark:text-amber-400">
          <Lock className="h-4 w-4" />
          Mode hanya-baca. Anda hanya dapat melihat topik yang ditugaskan kepada Anda.
        </div>
      )}

      {/* Sleek List Section */}
      <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Daftar Topik ({topiks.length})</h2>
        </div>
        
        <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
          {topiks.map((t) => {
            const count = soalRepo.all().filter((s) => s.topikId === t.id).length;
            return (
              <div key={t.id} className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:px-6 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors gap-4">
                
                <div className="flex-1 flex items-center gap-4">
                  <div className="h-10 w-10 shrink-0 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700">
                    <Layers className="h-4 w-4 text-slate-500" />
                  </div>
                  <div className="space-y-1">
                    <Link to="/admin/topik/$id/soal" params={{ id: t.id }} className="text-base font-semibold text-slate-900 dark:text-slate-100 hover:text-primary transition-colors block">
                      {t.nama}
                    </Link>
                    <div className="text-xs font-medium text-slate-500">
                      {count} Soal Terdaftar
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  {canEdit && (
                    <Button size="sm" variant="ghost" className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950" onClick={() => remove(t.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  <Button size="sm" className="h-8 shadow-sm" asChild>
                    <Link to="/admin/topik/$id/soal" params={{ id: t.id }}>
                      Kelola Soal <ChevronRight className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </div>
            );
          })}
          
          {topiks.length === 0 && (
            <div className="py-12 text-center text-slate-400">
              Belum ada topik yang dibuat.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
