import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { hydrateRepos, mataKuliahRepo, penawaranRepo, semesterRepo, usersRepo } from "@/lib/cbt/repos";
import { mutatePenawaranMataKuliahServer } from "@/lib/server/akademik/functions";
import { uid } from "@/lib/cbt/storage";
import type { PenawaranMataKuliah } from "@/lib/cbt/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/akademik/kelas-mata-kuliah")({
  component: KelasMataKuliahPage,
});

function KelasMataKuliahPage() {
  const [items, setItems] = useState<PenawaranMataKuliah[]>(penawaranRepo.all());
  const mataKuliah = mataKuliahRepo.all();
  const semester = semesterRepo.all();
  const mahasiswa = usersRepo.all().filter((user) => user.role === "mahasiswa" && user.aktif);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<PenawaranMataKuliah>({ id: "", mataKuliahId: "", semesterId: undefined, kodeKelas: "", pengampuIds: [], pesertaIds: [], createdAt: 0 });

  function add() {
    setForm({ id: uid("po_"), mataKuliahId: mataKuliah[0]?.id ?? "", semesterId: semester[0]?.id, kodeKelas: "", pengampuIds: [], pesertaIds: [], createdAt: Date.now() });
    setOpen(true);
  }

  function edit(item: PenawaranMataKuliah) {
    setForm({ ...item, pengampuIds: [...item.pengampuIds], pesertaIds: [...item.pesertaIds] });
    setOpen(true);
  }

  async function save() {
    if (!form.mataKuliahId) return toast.error("Mata kuliah wajib dipilih.");
    const existing = penawaranRepo.byId(form.id);
    const result = await mutatePenawaranMataKuliahServer({ data: { action: "upsert", payload: form } });
    if (!result.ok) return toast.error(result.error);
    await hydrateRepos();
    const saved = penawaranRepo.byId(form.id);
    if (existing && saved) penawaranRepo.updateMembership({ ...saved, pengampuIds: form.pengampuIds, pesertaIds: form.pesertaIds });
    setItems(penawaranRepo.all());
    setOpen(false);
    toast.success("Kelas mata kuliah disimpan.");
  }

  async function remove(id: string) {
    if (!confirm("Hapus kelas mata kuliah ini?")) return;
    const result = await mutatePenawaranMataKuliahServer({ data: { action: "remove", payload: { id } } });
    if (!result.ok) return toast.error(result.error);
    await hydrateRepos();
    setItems(penawaranRepo.all());
  }

  const toggle = (key: "pengampuIds" | "pesertaIds", id: string, checked: boolean) => {
    setForm((current) => ({ ...current, [key]: checked ? [...current[key], id] : current[key].filter((item) => item !== id) }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold">Kelas Mata Kuliah</h1><p className="text-sm text-muted-foreground">Atur kelas, pengampu, dan peserta untuk setiap mata kuliah.</p></div>
        <Button onClick={add}><Plus className="mr-2 h-4 w-4" />Tambah Kelas</Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((item) => {
          const mk = mataKuliah.find((value) => value.id === item.mataKuliahId);
          const smt = semester.find((value) => value.id === item.semesterId);
          return <Card key={item.id} className="p-4"><div className="flex items-start justify-between"><div><h2 className="font-semibold">{mk?.nama ?? "Mata kuliah tidak ditemukan"}</h2><p className="text-sm text-muted-foreground">{smt?.nama ?? "Tanpa semester"} · Kelas {item.kodeKelas || "-"}</p><p className="mt-2 text-xs text-muted-foreground">{item.pesertaIds.length} peserta · {item.pengampuIds.length} pengampu</p></div><div className="flex gap-1"><Button variant="ghost" size="icon" onClick={() => edit(item)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => remove(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></div></Card>;
        })}
        {items.length === 0 && <Card className="p-8 text-center text-sm text-muted-foreground md:col-span-2">Belum ada kelas mata kuliah.</Card>}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Kelas Mata Kuliah</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2"><Label>Mata Kuliah</Label><Select value={form.mataKuliahId} onValueChange={(value) => setForm({ ...form, mataKuliahId: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{mataKuliah.map((item) => <SelectItem key={item.id} value={item.id}>{item.kode} — {item.nama}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Kode Kelas</Label><Input value={form.kodeKelas} onChange={(event) => setForm({ ...form, kodeKelas: event.target.value })} placeholder="A" /></div>
            </div>
            <div><Label>Semester</Label><Select value={form.semesterId ?? "none"} onValueChange={(value) => setForm({ ...form, semesterId: value === "none" ? undefined : value })}><SelectTrigger><SelectValue placeholder="Pilih semester" /></SelectTrigger><SelectContent><SelectItem value="none">Tanpa semester</SelectItem>{semester.map((item) => <SelectItem key={item.id} value={item.id}>{item.nama}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Pengampu</Label><div className="grid max-h-32 gap-2 overflow-y-auto rounded border p-2 sm:grid-cols-2">{usersRepo.all().filter((user) => user.role !== "mahasiswa" && user.aktif).map((user) => <label key={user.id} className="flex items-center gap-2 text-sm"><Checkbox checked={form.pengampuIds.includes(user.id)} onCheckedChange={(checked) => toggle("pengampuIds", user.id, !!checked)} />{user.namaLengkap}</label>)}</div></div>
            <div><Label>Peserta</Label><div className="grid max-h-48 gap-2 overflow-y-auto rounded border p-2 sm:grid-cols-2">{mahasiswa.map((user) => <label key={user.id} className="flex items-center gap-2 text-sm"><Checkbox checked={form.pesertaIds.includes(user.id)} onCheckedChange={(checked) => toggle("pesertaIds", user.id, !!checked)} />{user.namaLengkap}</label>)}</div></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Batal</Button><Button onClick={save}>Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
