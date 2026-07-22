import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { mutateSemesterServer, getSemesterList, getTahunAkademikList } from "@/lib/server/akademik/functions";
import { uid } from "@/lib/cbt/storage";
import type { Semester } from "@/lib/cbt/types";
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

export const Route = createFileRoute("/_authenticated/admin/akademik/semester")({
  loader: async () => {
    const [items, taList] = await Promise.all([
      getSemesterList(),
      getTahunAkademikList()
    ]);
    return { items, taList };
  },
  component: SemesterPage,
});

function SemesterPage() {
  const router = useRouter();
  const { items: initialItems, taList } = Route.useLoaderData();
  const [items, setItems] = useState<Semester[]>(initialItems);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);
  
  const [editing, setEditing] = useState<Semester | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ id: "", nama: "", tahunAkademikId: "" });

  function handleAdd() {
    const activeTA = taList.find((t) => t.aktif)?.id ?? "";
    setForm({ id: uid("smt_"), nama: "", tahunAkademikId: activeTA });
    setEditing(null);
    setOpen(true);
  }

  function handleEdit(item: Semester) {
    setForm({ id: item.id, nama: item.nama, tahunAkademikId: item.tahunAkademikId });
    setEditing(item);
    setOpen(true);
  }

  async function handleRemove(id: string) {
    if (!confirm("Hapus semester ini?")) return;
    
    // Optimistic UI
    setItems((prev) => prev.filter((i) => i.id !== id));
    
    const res = await mutateSemesterServer({ data: { action: "remove", payload: { id } } });
    if (!res.ok) {
      toast.error(res.error || "Gagal menghapus");
      await router.invalidate();
      return;
    }
    toast.success("Semester dihapus");
    await router.invalidate();
  }

  async function save() {
    if (!form.nama.trim() || !form.tahunAkademikId) {
      toast.error("Nama dan Tahun Akademik wajib diisi");
      return;
    }
    const payload: Semester = { id: form.id, nama: form.nama.trim(), tahunAkademikId: form.tahunAkademikId };
    
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

    const res = await mutateSemesterServer({ data: { action: "upsert", payload } });
    if (!res.ok) {
      toast.error(res.error || "Gagal menyimpan");
      await router.invalidate();
      return;
    }
    toast.success("Semester disimpan");
    await router.invalidate();
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Daftar Semester</h2>
          <p className="text-sm text-slate-500">Kelola semester berjalan di dalam tahun akademik.</p>
        </div>
        <Button onClick={handleAdd} size="sm" className="h-9 font-semibold shadow-sm">
          <Plus className="mr-2 h-4 w-4" /> Tambah Semester
        </Button>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 overflow-hidden">
        <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800/60">
          {items.map((item) => {
            const ta = taList.find((t) => t.id === item.tahunAkademikId);
            return (
              <div key={item.id} className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-white dark:hover:bg-slate-800/50 transition-colors gap-2">
                <div className="flex-1">
                  <div className="font-medium text-slate-900 dark:text-slate-100">{item.nama}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {ta ? <span>Tahun Akademik: <span className="font-semibold text-slate-600 dark:text-slate-400">{ta.nama}</span></span> : "-"}
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
            <div className="p-8 text-center text-sm text-slate-400">Belum ada data semester.</div>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Semester" : "Tambah Semester"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nama Semester</Label>
              <Input
                value={form.nama}
                onChange={(e) => setForm({ ...form, nama: e.target.value })}
                placeholder="Mis: Ganjil"
              />
            </div>
            <div className="space-y-2">
              <Label>Tahun Akademik</Label>
              <Select value={form.tahunAkademikId} onValueChange={(v) => setForm({ ...form, tahunAkademikId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Tahun Akademik" />
                </SelectTrigger>
                <SelectContent>
                  {taList.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nama} {t.aktif && "(Aktif)"}
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
