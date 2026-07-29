import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { mataKuliahRepo, unitAkademikRepo, semesterRepo, tahunAkademikRepo } from "@/lib/cbt/repos";
import { mutateMataKuliahServer } from "@/lib/server/akademik/functions";
import { uid } from "@/lib/cbt/storage";
import type { MataKuliah } from "@/lib/cbt/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Pencil, BookOpen, Search } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/admin/akademik/mata-kuliah")({
  component: MataKuliahPage,
});

function MataKuliahPage() {
  const [items, setItems] = useState<MataKuliah[]>(mataKuliahRepo.all());
  const [search, setSearch] = useState("");
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
    const targetKode = form.kode.trim().toUpperCase();
    const isDuplicateKode = items.some(
      (item) => item.kode.trim().toUpperCase() === targetKode && item.id !== form.id
    );
    if (isDuplicateKode) {
      toast.error(`Kode Mata Kuliah "${targetKode}" sudah digunakan!`);
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

  const filteredItems = items.filter(
    (item) =>
      item.nama.toLowerCase().includes(search.toLowerCase()) ||
      item.kode.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Daftar Mata Kuliah</h2>
          <p className="text-sm text-muted-foreground">Kelola mata kuliah untuk penjadwalan ujian.</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari mata kuliah..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <Button onClick={handleAdd} size="sm" className="shadow-sm h-9 shrink-0">
            <Plus className="mr-2 h-4 w-4" /> Tambah MK
          </Button>
        </div>
      </div>

      <Card className="shadow-sm border-border overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="w-[15%]">Kode</TableHead>
              <TableHead className="w-[35%]">Nama Mata Kuliah</TableHead>
              <TableHead className="w-[25%]">Unit & Semester</TableHead>
              <TableHead className="w-[10%] text-center">SKS</TableHead>
              <TableHead className="w-[15%] text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredItems.map((item) => {
              const unit = unitList.find((p) => p.id === item.unitId);
              const semester = semesterList.find((s) => s.id === item.semesterId);
              const ta = taList.find((t) => t.id === semester?.tahunAkademikId);

              return (
                <TableRow key={item.id} className="group hover:bg-muted/30 transition-colors">
                  <TableCell>
                    <Badge variant="outline" className="font-mono font-bold text-xs uppercase bg-muted/50 text-foreground border-border">
                      {item.kode}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-semibold text-foreground">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>{item.nama}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <div className="space-y-0.5">
                      <div className="font-medium text-foreground">{unit?.nama ?? "-"}</div>
                      <div>{semester?.nama ?? "-"} {ta ? `(${ta.nama})` : ""}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className="font-bold text-xs">
                      {item.sks} SKS
                    </Badge>
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
            {filteredItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                  {search ? "Tidak ada mata kuliah yang sesuai dengan kata kunci." : "Belum ada data mata kuliah."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

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
