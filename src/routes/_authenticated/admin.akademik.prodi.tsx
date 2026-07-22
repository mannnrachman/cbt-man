import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { mutateProdiServer, getProdiList, getJurusanList, getFakultasList } from "@/lib/server/akademik/functions";
import { uid } from "@/lib/cbt/storage";
import type { ProgramStudi } from "@/lib/cbt/types";
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

export const Route = createFileRoute("/_authenticated/admin/akademik/prodi")({
  loader: async () => {
    const [items, jurusanList, fakultasList] = await Promise.all([
      getProdiList(),
      getJurusanList(),
      getFakultasList()
    ]);
    return { items, jurusanList, fakultasList };
  },
  component: ProdiPage,
});

function ProdiPage() {
  const router = useRouter();
  const { items: initialItems, jurusanList, fakultasList } = Route.useLoaderData();
  const [items, setItems] = useState<ProgramStudi[]>(initialItems);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);
  
  const [editing, setEditing] = useState<ProgramStudi | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ id: "", nama: "", jurusanId: "" });

  function handleAdd() {
    setForm({ id: uid("p_"), nama: "", jurusanId: "" });
    setEditing(null);
    setOpen(true);
  }

  function handleEdit(item: ProgramStudi) {
    setForm({ id: item.id, nama: item.nama, jurusanId: item.jurusanId });
    setEditing(item);
    setOpen(true);
  }

  async function handleRemove(id: string) {
    if (!confirm("Hapus program studi ini?")) return;
    
    // Optimistic UI
    setItems((prev) => prev.filter((i) => i.id !== id));
    
    const res = await mutateProdiServer({ data: { action: "remove", payload: { id } } });
    if (!res.ok) {
      toast.error(res.error || "Gagal menghapus");
      await router.invalidate();
      return;
    }
    toast.success("Program Studi dihapus");
    await router.invalidate();
  }

  async function save() {
    if (!form.nama.trim() || !form.jurusanId) {
      toast.error("Nama dan Jurusan wajib diisi");
      return;
    }
    const payload: ProgramStudi = { id: form.id, nama: form.nama.trim(), jurusanId: form.jurusanId };
    
    // Optimistic UI
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === payload.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = payload;
        return next;
      }
      return [...prev, payload];
    });
    setOpen(false);

    const res = await mutateProdiServer({ data: { action: "upsert", payload } });
    if (!res.ok) {
      toast.error(res.error || "Gagal menyimpan");
      await router.invalidate();
      return;
    }
    toast.success("Program Studi disimpan");
    await router.invalidate();
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Daftar Program Studi</h2>
          <p className="text-sm text-slate-500">Kelola prodi (level terbawah struktur institusi).</p>
        </div>
        <Button onClick={handleAdd} size="sm" className="h-9 font-semibold shadow-sm">
          <Plus className="mr-2 h-4 w-4" /> Tambah Prodi
        </Button>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 overflow-hidden">
        <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800/60">
          {items.map((item) => {
            const jurusan = jurusanList.find((j) => j.id === item.jurusanId);
            const fakultas = fakultasList.find((f) => f.id === jurusan?.fakultasId);
            return (
              <div key={item.id} className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-white dark:hover:bg-slate-800/50 transition-colors gap-2">
                <div className="flex-1">
                  <div className="font-medium text-slate-900 dark:text-slate-100">{item.nama}</div>
                  <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                    {fakultas ? <span className="font-semibold text-slate-600 dark:text-slate-400">{fakultas.nama}</span> : "-"}
                    <span>/</span>
                    {jurusan ? <span>{jurusan.nama}</span> : "-"}
                  </div>
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
            <div className="p-8 text-center text-sm text-slate-400">Belum ada data program studi.</div>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Program Studi" : "Tambah Program Studi"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nama Program Studi</Label>
              <Input
                value={form.nama}
                onChange={(e) => setForm({ ...form, nama: e.target.value })}
                placeholder="Mis: D4 Rekayasa Perangkat Lunak"
              />
            </div>
            <div className="space-y-2">
              <Label>Jurusan</Label>
              <Select value={form.jurusanId} onValueChange={(v) => setForm({ ...form, jurusanId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Jurusan" />
                </SelectTrigger>
                <SelectContent>
                  {jurusanList.map((j) => (
                    <SelectItem key={j.id} value={j.id}>
                      {j.nama}
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
