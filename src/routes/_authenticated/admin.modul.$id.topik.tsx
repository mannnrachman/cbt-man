import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { modulRepo, topikRepo, soalRepo } from "@/lib/cbt/repos";
import { uid } from "@/lib/cbt/storage";
import type { Topik } from "@/lib/cbt/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, ChevronRight, Lock, BookOpen, Layers, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/cbt/auth-store";
import { allowedTopikIdSet, isUnrestricted } from "@/lib/cbt/access";
import { useConfirmDialog } from "@/components/cbt/ConfirmDialog";

export const Route = createFileRoute("/_authenticated/admin/modul/$id/topik")({
  component: TopikPage,
});

function TopikPage() {
  const { confirm, dialog } = useConfirmDialog();
  const { id: modulId } = useParams({ from: "/_authenticated/admin/modul/$id/topik" });
  const user = useAuthStore((s) => s.user);
  const canEdit = isUnrestricted(user);
  const allowedSet = allowedTopikIdSet(user);
  const modul = modulRepo.byId(modulId);
  const filterMine = (list: Topik[]) =>
    list.filter((t) => t.modulId === modulId && (!allowedSet || allowedSet.has(t.id)));
  const [topiks, setTopiks] = useState<Topik[]>(filterMine(topikRepo.all()));
  const [nama, setNama] = useState("");
  const [editingTopik, setEditingTopik] = useState<Topik | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editNama, setEditNama] = useState("");

  if (!modul) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <p className="text-muted-foreground mb-4">Modul tidak ditemukan.</p>
      <Button asChild variant="outline"><Link to="/admin/modul">Kembali ke Bank Soal</Link></Button>
    </div>
  );

  function add() {
    if (!canEdit) return;
    if (!nama.trim()) return;
    topikRepo.upsert({ id: uid("t_"), modulId, nama: nama.trim() });
    setNama(""); setTopiks(filterMine(topikRepo.all())); toast.success("Topik ditambahkan");
  }

  async function remove(id: string) {
    if (!canEdit) return;
    if (soalRepo.all().some((s) => s.topikId === id)) { toast.error("Hapus soal di topik ini dulu"); return; }
    if (!(await confirm({ title: "Hapus topik", description: "Hapus topik?", confirmLabel: "Hapus" }))) return;
    topikRepo.remove(id); setTopiks(filterMine(topikRepo.all()));
    toast.success("Topik dihapus");
  }

  function openEdit(t: Topik) {
    setEditingTopik(t);
    setEditNama(t.nama);
    setEditDialogOpen(true);
  }

  function saveEdit() {
    if (!editingTopik || !editNama.trim()) return;
    topikRepo.upsert({ ...editingTopik, nama: editNama.trim() });
    setTopiks(filterMine(topikRepo.all()));
    toast.success("Nama topik diperbarui");
    setEditDialogOpen(false);
  }

  return (
    <div className="max-w-6xl mx-auto space-y-10 duration-500 pb-12 pt-4">
      {/* Header Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end justify-between border-b border-border pb-6">
        <div className="space-y-1">
          <Link to="/admin/modul" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 w-fit mb-3">
            ← Kembali ke Bank Soal
          </Link>
          <div className="flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-muted-foreground" />
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{modul.nama}</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Kelola topik/bab untuk modul ini. Setiap topik dapat berisi puluhan hingga ratusan soal.
          </p>
        </div>
      </div>

      {/* Creation Row */}
      {canEdit ? (
        <form onSubmit={(e) => { e.preventDefault(); add(); }} className="bg-muted p-4 rounded-lg border border-border flex flex-col sm:flex-row items-center gap-3">
          <Input 
            placeholder="Ketik nama topik baru Bab Pengantar)" 
            value={nama} 
            onChange={(e) => setNama(e.target.value)} 
            className="flex-1 bg-card border-border"
          />
          <Button type="submit" disabled={!nama.trim()} className="w-full sm:w-auto font-semibold">
            <Plus className="mr-2 h-4 w-4" />Tambah Topik
          </Button>
        </form>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border border-warn/50 bg-warn/50 p-4 text-sm text-warn">
          <Lock className="h-4 w-4" />
          Mode hanya-baca. Anda hanya dapat melihat topik yang ditugaskan kepada Anda.
        </div>
      )}

      {/* Sleek List Section */}
      <section className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="px-6 py-4 border-b border-border bg-muted/50">
          <h2 className="text-label font-semibold text-muted-foreground">Daftar Topik ({topiks.length})</h2>
        </div>
        
        <div className="flex flex-col divide-y divide-border">
          {topiks.map((t) => {
            const count = soalRepo.all().filter((s) => s.topikId === t.id).length;
            return (
              <div key={t.id} className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:px-6 hover:bg-muted transition-colors gap-4">
                
                <div className="flex-1 flex items-center gap-4">
                  <div className="h-10 w-10 shrink-0 rounded-full bg-muted flex items-center justify-center border border-border">
                    <Layers className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="space-y-1">
                    <Link to="/admin/topik/$id/soal" params={{ id: t.id }} className="text-base font-semibold text-foreground hover:text-primary transition-colors block">
                      {t.nama}
                    </Link>
                    <div className="text-label font-medium text-muted-foreground">
                      {count} Soal Terdaftar
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  {canEdit && (
                    <>
                      <Button size="sm" variant="ghost" className="h-8 text-muted-foreground hover:text-foreground" onClick={() => openEdit(t)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => remove(t.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  <Button size="sm" className="h-8" asChild>
                    <Link to="/admin/topik/$id/soal" params={{ id: t.id }}>
                      Kelola Soal <ChevronRight className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </div>
            );
          })}
          
          {topiks.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              Belum ada topik yang dibuat.
            </div>
          )}
        </div>
      </section>

      {/* Edit Topik Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Nama Topik</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Nama Topik / Bab</Label>
            <Input
              value={editNama}
              onChange={(e) => setEditNama(e.target.value)}
              placeholder="Ketik nama topik..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Batal</Button>
            <Button onClick={saveEdit}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {dialog}
    </div>
  );
}
