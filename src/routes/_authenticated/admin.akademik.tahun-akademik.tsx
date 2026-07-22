import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { tahunAkademikRepo } from "@/lib/cbt/repos";
import { mutateTahunAkademikServer } from "@/lib/server/akademik/functions";
import { uid } from "@/lib/cbt/storage";
import type { TahunAkademik } from "@/lib/cbt/types";
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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/akademik/tahun-akademik")({
  component: TahunAkademikPage,
});

function TahunAkademikPage() {
  const [items, setItems] = useState<TahunAkademik[]>(tahunAkademikRepo.all());
  
  const [editing, setEditing] = useState<TahunAkademik | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ id: "", nama: "", aktif: false });

  function handleAdd() {
    setForm({ id: uid("ta_"), nama: "", aktif: false });
    setEditing(null);
    setOpen(true);
  }

  function handleEdit(item: TahunAkademik) {
    setForm({ id: item.id, nama: item.nama, aktif: item.aktif });
    setEditing(item);
    setOpen(true);
  }

  async function handleRemove(id: string) {
    if (!confirm("Hapus tahun akademik ini?")) return;
    const res = await mutateTahunAkademikServer({ data: { action: "remove", payload: { id } } });
    if (!res.ok) {
      toast.error(res.error || "Gagal menghapus");
      return;
    }
    tahunAkademikRepo.remove(id);
    setItems(tahunAkademikRepo.all());
    toast.success("Tahun Akademik dihapus");
  }

  async function save() {
    if (!form.nama.trim()) {
      toast.error("Nama wajib diisi");
      return;
    }
    const payload: TahunAkademik = { id: form.id, nama: form.nama.trim(), aktif: form.aktif };
    const res = await mutateTahunAkademikServer({ data: { action: "upsert", payload } });
    if (!res.ok) {
      toast.error(res.error || "Gagal menyimpan");
      return;
    }
    tahunAkademikRepo.upsert(payload);
    setItems(tahunAkademikRepo.all());
    toast.success("Tahun Akademik disimpan");
    setOpen(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">Daftar Tahun Akademik</h2>
          <p className="text-sm text-slate-500">Kelola periode waktu perkuliahan institusi.</p>
        </div>
        <Button onClick={handleAdd} size="sm" className="h-9">
          <Plus className="mr-2 h-4 w-4" /> Tambah Tahun Akademik
        </Button>
      </div>

      <AdminPageContent className="p-0">
        <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800/60">
          {items.map((item) => (
            <div key={item.id} className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-white dark:hover:bg-slate-800/50 transition-colors gap-2">
              <div className="flex items-center gap-3">
                <div className="font-medium text-slate-900 dark:text-slate-100">{item.nama}</div>
                {item.aktif ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-[10px] font-semibold tracking-wide uppercase text-emerald-700 dark:text-emerald-400">
                    Aktif
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold tracking-wide uppercase text-slate-500">
                    Tidak Aktif
                  </span>
                )}
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
          ))}
          {items.length === 0 && (
            <div className="p-8 text-center text-sm text-slate-400">Belum ada data tahun akademik.</div>
          )}
        </div>
      </AdminPageContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Tahun Akademik" : "Tambah Tahun Akademik"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nama Tahun Akademik</Label>
              <Input
                value={form.nama}
                onChange={(e) => setForm({ ...form, nama: e.target.value })}
                placeholder="Mis: 2024/2025"
                onKeyDown={(e) => {
                  if (e.key === "Enter") save();
                }}
                autoFocus
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={form.aktif}
                onCheckedChange={(c) => setForm({ ...form, aktif: c })}
                id="aktif-mode"
              />
              <Label htmlFor="aktif-mode" className="font-normal">
                Tandai sebagai Tahun Akademik Aktif
              </Label>
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
