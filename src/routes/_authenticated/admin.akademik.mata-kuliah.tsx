import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { mataKuliahRepo, unitAkademikRepo, semesterRepo, tahunAkademikRepo } from "@/lib/cbt/repos";
import { mutateMataKuliahServer } from "@/lib/server/akademik/functions";
import { uid } from "@/lib/cbt/storage";
import type { MataKuliah } from "@/lib/cbt/types";
import { AdminPageContent } from "@/components/cbt/AdminPage";
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

export const Route = createFileRoute("/_authenticated/admin/akademik/mata-kuliah")({
  component: MataKuliahPage,
});

function MataKuliahPage() {
  const [items, setItems] = useState<MataKuliah[]>(mataKuliahRepo.all());
  const unitList = unitAkademikRepo.all();
  const semesterList = semesterRepo.all();
  const taList = tahunAkademikRepo.all();
  
  const [editing, setEditing] = useState<MataKuliah | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ id: "", kode: "", nama: "", sks: 2, unitId: "", semesterId: "" });

  function handleAdd() {
    setForm({ id: uid("mk_"), kode: "", nama: "", sks: 2, unitId: "", semesterId: "" });
    setEditing(null);
    setOpen(true);
  }

  function handleEdit(item: MataKuliah) {
    setForm({ id: item.id, kode: item.kode, nama: item.nama, sks: item.sks, unitId: item.unitId || "", semesterId: item.semesterId || "" });
    setEditing(item);
    setOpen(true);
  }

  async function handleRemove(id: string) {
    if (!confirm("Hapus mata kuliah ini?")) return;
    const res = await mutateMataKuliahServer({ data: { action: "remove", payload: { id } } });
    if (!res.ok) {
      toast.error(res.error || "Gagal menghapus");
      return;
    }
    mataKuliahRepo.remove(id);
    setItems(mataKuliahRepo.all());
    toast.success("Mata Kuliah dihapus");
  }

  async function save() {
    if (!form.nama.trim() || !form.kode.trim() || !form.unitId || !form.semesterId) {
      toast.error("Kode, Nama, Unit, dan Semester wajib diisi");
      return;
    }
    const payload: MataKuliah = { 
      id: form.id, 
      kode: form.kode.trim(), 
      nama: form.nama.trim(), 
      sks: form.sks,
      unitId: form.unitId,
      semesterId: form.semesterId 
    };
    const res = await mutateMataKuliahServer({ data: { action: "upsert", payload } });
    if (!res.ok) {
      toast.error(res.error || "Gagal menyimpan");
      return;
    }
    mataKuliahRepo.upsert(payload);
    setItems(mataKuliahRepo.all());
    toast.success("Mata Kuliah disimpan");
    setOpen(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">Daftar Mata Kuliah</h2>
          <p className="text-sm text-slate-500">Kelola mata kuliah untuk penjadwalan ujian.</p>
        </div>
        <Button onClick={handleAdd} size="sm" className="h-9">
          <Plus className="mr-2 h-4 w-4" /> Tambah Mata Kuliah
        </Button>
      </div>

      <AdminPageContent className="p-0">
        <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800/60">
          {items.map((item) => {
            const unit = unitList.find((p) => p.id === item.unitId);
            const semester = semesterList.find((s) => s.id === item.semesterId);
            const ta = taList.find((t) => t.id === semester?.tahunAkademikId);
            return (
              <div key={item.id} className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-white dark:hover:bg-slate-800/50 transition-colors gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-mono font-bold tracking-widest text-slate-500 uppercase">
                      {item.kode}
                    </span>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">{item.nama}</div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                      {item.sks} SKS
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1.5 flex flex-wrap items-center gap-3">
                    <span className="flex items-center gap-1"><span className="text-slate-400">Unit:</span> <span className="font-medium text-slate-600 dark:text-slate-300">{unit?.nama ?? "-"}</span></span>
                    <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                    <span className="flex items-center gap-1"><span className="text-slate-400">Semester:</span> <span className="font-medium text-slate-600 dark:text-slate-300">{semester?.nama ?? "-"} {ta ? `(${ta.nama})` : ""}</span></span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="h-8" onClick={() => handleEdit(item)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 text-destructive hover:bg-destructive/10" onClick={() => handleRemove(item.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
          {items.length === 0 && (
            <div className="p-8 text-center text-sm text-slate-400">Belum ada data mata kuliah.</div>
          )}
        </div>
      </AdminPageContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Mata Kuliah" : "Tambah Mata Kuliah"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Kode Mata Kuliah</Label>
                <Input
                  value={form.kode}
                  onChange={(e) => setForm({ ...form, kode: e.target.value })}
                  placeholder="Mis: IF101"
                />
              </div>
              <div className="space-y-2">
                <Label>SKS</Label>
                <Input
                  type="number"
                  min="1"
                  max="8"
                  value={form.sks}
                  onChange={(e) => setForm({ ...form, sks: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nama Mata Kuliah</Label>
              <Input
                value={form.nama}
                onChange={(e) => setForm({ ...form, nama: e.target.value })}
                placeholder="Mis: Algoritma Pemrograman"
              />
            </div>
            <div className="space-y-2">
              <Label>Unit Akademik</Label>
              <Select value={form.unitId} onValueChange={(v) => setForm({ ...form, unitId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Unit Akademik" />
                </SelectTrigger>
                <SelectContent>
                  {unitList.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nama}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Semester</Label>
              <Select value={form.semesterId} onValueChange={(v) => setForm({ ...form, semesterId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Semester" />
                </SelectTrigger>
                <SelectContent>
                  {semesterList.map((s) => {
                    const ta = taList.find((t) => t.id === s.tahunAkademikId);
                    return (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nama} {ta ? `- ${ta.nama}` : ""}
                      </SelectItem>
                    );
                  })}
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
