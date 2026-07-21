import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { fakultasRepo } from "@/lib/cbt/repos";
import { mutateFakultasServer } from "@/lib/server/akademik/functions";
import { uid } from "@/lib/cbt/storage";
import type { Fakultas } from "@/lib/cbt/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/admin/akademik/fakultas")({
  component: FakultasPage,
});

function FakultasPage() {
  const [items, setItems] = useState<Fakultas[]>(fakultasRepo.all());
  const [editing, setEditing] = useState<Fakultas | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ id: "", nama: "" });

  function handleAdd() {
    setForm({ id: uid("f_"), nama: "" });
    setEditing(null);
    setOpen(true);
  }

  function handleEdit(item: Fakultas) {
    setForm({ id: item.id, nama: item.nama });
    setEditing(item);
    setOpen(true);
  }

  async function handleRemove(id: string) {
    if (!confirm("Hapus fakultas ini?")) return;
    const res = await mutateFakultasServer({ data: { action: "remove", payload: { id } } });
    if (!res.ok) {
      toast.error(res.error || "Gagal menghapus");
      return;
    }
    fakultasRepo.remove(id);
    setItems(fakultasRepo.all());
    toast.success("Fakultas dihapus");
  }

  async function save() {
    if (!form.nama.trim()) {
      toast.error("Nama wajib diisi");
      return;
    }
    const payload: Fakultas = { id: form.id, nama: form.nama.trim() };
    const res = await mutateFakultasServer({ data: { action: "upsert", payload } });
    if (!res.ok) {
      toast.error(res.error || "Gagal menyimpan");
      return;
    }
    fakultasRepo.upsert(payload);
    setItems(fakultasRepo.all());
    toast.success("Fakultas disimpan");
    setOpen(false);
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Daftar Fakultas</h2>
          <p className="text-sm text-slate-500">Kelola data induk fakultas di institusi ini.</p>
        </div>
        <Button onClick={handleAdd} size="sm" className="h-9 font-semibold shadow-sm">
          <Plus className="mr-2 h-4 w-4" /> Tambah Fakultas
        </Button>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 overflow-hidden">
        <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800/60">
          {items.map((item) => (
            <div key={item.id} className="group flex items-center justify-between p-4 hover:bg-white dark:hover:bg-slate-800/50 transition-colors">
              <div className="font-medium text-slate-900 dark:text-slate-100">{item.nama}</div>
              <div className="flex items-center gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-400 hover:text-slate-900 dark:hover:text-white" onClick={() => handleEdit(item)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950" onClick={() => handleRemove(item.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <div className="p-8 text-center text-sm text-slate-400">Belum ada data fakultas.</div>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Fakultas" : "Tambah Fakultas"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nama Fakultas</Label>
              <Input
                value={form.nama}
                onChange={(e) => setForm({ ...form, nama: e.target.value })}
                placeholder="Mis: Fakultas Ilmu Komputer"
                onKeyDown={(e) => {
                  if (e.key === "Enter") save();
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button onClick={save}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
