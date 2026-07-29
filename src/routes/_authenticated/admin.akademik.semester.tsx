import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { semesterRepo, tahunAkademikRepo } from "@/lib/cbt/repos";
import { mutateSemesterServer } from "@/lib/server/akademik/functions";
import { uid } from "@/lib/cbt/storage";
import type { Semester } from "@/lib/cbt/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Pencil, Clock } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/admin/akademik/semester")({
  component: SemesterPage,
});

function SemesterPage() {
  const [items, setItems] = useState<Semester[]>(semesterRepo.all());
  const taList = tahunAkademikRepo.all();
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
    const res = await mutateSemesterServer({ data: { action: "remove", payload: { id } } });
    if (!res.ok) {
      toast.error(res.error || "Gagal menghapus");
      return;
    }
    semesterRepo.remove(id);
    setItems(semesterRepo.all());
    toast.success("Semester dihapus");
  }

  async function save() {
    if (!form.nama.trim() || !form.tahunAkademikId) {
      toast.error("Nama dan Tahun Akademik wajib diisi");
      return;
    }
    const payload: Semester = { id: form.id, nama: form.nama.trim(), tahunAkademikId: form.tahunAkademikId };
    const res = await mutateSemesterServer({ data: { action: "upsert", payload } });
    if (!res.ok) {
      toast.error(res.error || "Gagal menyimpan");
      return;
    }
    semesterRepo.upsert(payload);
    setItems(semesterRepo.all());
    toast.success("Semester disimpan");
    setOpen(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Daftar Semester</h2>
          <p className="text-sm text-muted-foreground">Kelola semester berjalan di dalam tahun akademik.</p>
        </div>
        <Button onClick={handleAdd} size="sm" className="shadow-sm">
          <Plus className="mr-2 h-4 w-4" /> Tambah Semester
        </Button>
      </div>

      <Card className="shadow-sm border-border overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="w-[40%]">Nama Semester</TableHead>
              <TableHead className="w-[40%]">Tahun Akademik</TableHead>
              <TableHead className="w-[20%] text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const ta = taList.find((t) => t.id === item.tahunAkademikId);
              return (
                <TableRow key={item.id} className="group hover:bg-muted/30 transition-colors">
                  <TableCell className="font-semibold text-foreground">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      {item.nama}
                    </div>
                  </TableCell>
                  <TableCell>
                    {ta ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{ta.nama}</span>
                        {ta.aktif && (
                          <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-semibold">
                            Aktif
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => handleEdit(item)} aria-label={`Edit ${item.nama}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleRemove(item.id)} aria-label={`Hapus ${item.nama}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="h-32 text-center text-muted-foreground">
                  Belum ada data semester.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

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
