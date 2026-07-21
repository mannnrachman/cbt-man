import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { jurusanRepo, fakultasRepo } from "@/lib/cbt/repos";
import { mutateJurusanServer } from "@/lib/server/akademik/functions";
import { uid } from "@/lib/cbt/storage";
import type { Jurusan } from "@/lib/cbt/types";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/akademik/jurusan")({
  component: JurusanPage,
});

function JurusanPage() {
  const [items, setItems] = useState<Jurusan[]>(jurusanRepo.all());
  const fakultasList = fakultasRepo.all();
  
  const [editing, setEditing] = useState<Jurusan | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ id: "", nama: "", fakultasId: "" });

  function handleAdd() {
    setForm({ id: uid("j_"), nama: "", fakultasId: "" });
    setEditing(null);
    setOpen(true);
  }

  function handleEdit(item: Jurusan) {
    setForm({ id: item.id, nama: item.nama, fakultasId: item.fakultasId });
    setEditing(item);
    setOpen(true);
  }

  async function handleRemove(id: string) {
    if (!confirm("Hapus jurusan ini?")) return;
    const res = await mutateJurusanServer({ data: { action: "remove", payload: { id } } });
    if (!res.ok) {
      toast.error(res.error || "Gagal menghapus");
      return;
    }
    jurusanRepo.remove(id);
    setItems(jurusanRepo.all());
    toast.success("Jurusan dihapus");
  }

  async function save() {
    if (!form.nama.trim() || !form.fakultasId) {
      toast.error("Nama dan Fakultas wajib diisi");
      return;
    }
    const payload: Jurusan = { id: form.id, nama: form.nama.trim(), fakultasId: form.fakultasId };
    const res = await mutateJurusanServer({ data: { action: "upsert", payload } });
    if (!res.ok) {
      toast.error(res.error || "Gagal menyimpan");
      return;
    }
    jurusanRepo.upsert(payload);
    setItems(jurusanRepo.all());
    toast.success("Jurusan disimpan");
    setOpen(false);
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Daftar Jurusan</h2>
          <p className="text-sm text-slate-500">Kelola pengelompokan program studi di bawah fakultas.</p>
        </div>
        <Button onClick={handleAdd} size="sm" className="h-9 font-semibold shadow-sm">
          <Plus className="mr-2 h-4 w-4" /> Tambah Jurusan
        </Button>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 overflow-hidden">
        <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800/60">
          {items.map((item) => {
            const fakultas = fakultasList.find((f) => f.id === item.fakultasId);
            return (
              <div key={item.id} className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-white dark:hover:bg-slate-800/50 transition-colors gap-2">
                <div className="flex-1">
                  <div className="font-medium text-slate-900 dark:text-slate-100">{item.nama}</div>
                  {fakultas && (
                    <div className="text-xs text-slate-500 mt-0.5">{fakultas.nama}</div>
                  )}
                </div>
                <div className="flex items-center gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-400 hover:text-slate-900 dark:hover:text-white" onClick={() => handleEdit(item)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950" onClick={() => handleRemove(item.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
          {items.length === 0 && (
            <div className="p-8 text-center text-sm text-slate-400">Belum ada data jurusan.</div>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Jurusan" : "Tambah Jurusan"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nama Jurusan</Label>
              <Input
                value={form.nama}
                onChange={(e) => setForm({ ...form, nama: e.target.value })}
                placeholder="Mis: Teknik Informatika"
              />
            </div>
            <div className="space-y-2">
              <Label>Fakultas</Label>
              <Select value={form.fakultasId} onValueChange={(v) => setForm({ ...form, fakultasId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Fakultas" />
                </SelectTrigger>
                <SelectContent>
                  {fakultasList.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.nama}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
