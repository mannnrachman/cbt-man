import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { tahunAkademikRepo } from "@/lib/cbt/repos";
import { mutateTahunAkademikServer } from "@/lib/server/akademik/functions";
import { uid } from "@/lib/cbt/storage";
import type { TahunAkademik } from "@/lib/cbt/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Pencil, Calendar, CheckCircle2 } from "lucide-react";
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
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
          <h2 className="text-xl font-bold tracking-tight text-foreground">Daftar Tahun Akademik</h2>
          <p className="text-sm text-muted-foreground">Kelola periode waktu perkuliahan institusi.</p>
        </div>
        <Button onClick={handleAdd} size="sm" className="shadow-sm">
          <Plus className="mr-2 h-4 w-4" /> Tambah Tahun Akademik
        </Button>
      </div>

      <Card className="shadow-sm border-border overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="w-[50%]">Tahun Akademik</TableHead>
              <TableHead className="w-[30%]">Status</TableHead>
              <TableHead className="w-[20%] text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id} className="group hover:bg-muted/30 transition-colors">
                <TableCell className="font-semibold text-foreground">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {item.nama}
                  </div>
                </TableCell>
                <TableCell>
                  {item.aktif ? (
                    <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600 border-transparent shadow-none text-white">
                      <CheckCircle2 className="mr-1 h-3 w-3" /> Aktif
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-muted-foreground shadow-none">
                      Tidak Aktif
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => handleEdit(item)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleRemove(item.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="h-32 text-center text-muted-foreground">
                  Belum ada data tahun akademik.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

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
            <div className="flex items-center space-x-2 pt-2">
              <Switch
                checked={form.aktif}
                onCheckedChange={(c) => setForm({ ...form, aktif: c })}
                id="aktif-mode"
              />
              <Label htmlFor="aktif-mode" className="font-normal cursor-pointer">
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
