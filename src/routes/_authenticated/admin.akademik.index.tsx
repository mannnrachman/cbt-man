import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { getFakultasList, getProgramStudiList, getRombelList, mutateFakultasServer, mutateProgramStudiServer, mutateRombelServer } from "@/lib/server/akademik/functions";
import type { Fakultas, ProgramStudi, Rombel } from "@/lib/cbt/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit2, Trash2, Building2, Library, Users } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/admin/akademik/")({
  loader: async () => {
    const [fakultas, prodi, rombel] = await Promise.all([
      getFakultasList(),
      getProgramStudiList(),
      getRombelList(),
    ]);
    return { fakultas, prodi, rombel };
  },
  component: AkademikExplorer,
});

function AkademikExplorer() {
  const data = Route.useLoaderData();
  const [fakultas, setFakultas] = useState<Fakultas[]>(data.fakultas);
  const [prodi, setProdi] = useState<ProgramStudi[]>(data.prodi);
  const [rombel, setRombel] = useState<Rombel[]>(data.rombel);

  const reload = async () => {
    const [f, p, r] = await Promise.all([getFakultasList(), getProgramStudiList(), getRombelList()]);
    setFakultas(f);
    setProdi(p);
    setRombel(r);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Struktur Akademik</h1>
      <Tabs defaultValue="fakultas">
        <TabsList>
          <TabsTrigger value="fakultas">Fakultas</TabsTrigger>
          <TabsTrigger value="prodi">Program Studi</TabsTrigger>
          <TabsTrigger value="rombel">Kelas</TabsTrigger>
        </TabsList>
        <TabsContent value="fakultas">
          <FakultasTab data={fakultas} reload={reload} />
        </TabsContent>
        <TabsContent value="prodi">
          <ProdiTab data={prodi} fakultas={fakultas} reload={reload} />
        </TabsContent>
        <TabsContent value="rombel">
          <RombelTab data={rombel} prodi={prodi} reload={reload} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FakultasTab({ data, reload }: { data: Fakultas[], reload: () => void }) {
  const [form, setForm] = useState({ id: "", nama: "" });

  const save = async () => {
    if (!form.nama.trim()) return toast.error("Nama wajib diisi!");
    const payload: Fakultas = { id: form.id || `f_${Date.now()}`, nama: form.nama.trim() };
    const res = await mutateFakultasServer({ data: { action: "upsert", payload } });
    if (!res.ok) return toast.error(res.error);
    toast.success("Tersimpan");
    setForm({ id: "", nama: "" });
    reload();
  };

  const remove = async (id: string) => {
    if (!confirm("Hapus?")) return;
    const res = await mutateFakultasServer({ data: { action: "remove", payload: { id } } });
    if (!res.ok) return toast.error(res.error);
    toast.success("Terhapus");
    reload();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
      <Card className="md:col-span-2">
        <CardHeader><CardTitle>Daftar Fakultas</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.map(f => (
              <div key={f.id} className="flex items-center justify-between p-2 border rounded">
                <div className="flex items-center gap-2"><Building2 className="h-4 w-4" /> {f.nama}</div>
                <div>
                  <Button variant="ghost" size="icon" onClick={() => setForm(f)}><Edit2 className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(f.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{form.id ? "Edit" : "Tambah"} Fakultas</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nama</Label>
            <Input value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <Button onClick={save}>Simpan</Button>
            {form.id && <Button variant="outline" onClick={() => setForm({ id: "", nama: "" })}>Batal</Button>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ProdiTab({ data, fakultas, reload }: { data: ProgramStudi[], fakultas: Fakultas[], reload: () => void }) {
  const [form, setForm] = useState({ id: "", nama: "", fakultasId: "" });

  const save = async () => {
    if (!form.nama.trim() || !form.fakultasId) return toast.error("Semua field wajib diisi!");
    const payload: ProgramStudi = { id: form.id || `p_${Date.now()}`, nama: form.nama.trim(), fakultasId: form.fakultasId };
    const res = await mutateProgramStudiServer({ data: { action: "upsert", payload } });
    if (!res.ok) return toast.error(res.error);
    toast.success("Tersimpan");
    setForm({ id: "", nama: "", fakultasId: "" });
    reload();
  };

  const remove = async (id: string) => {
    if (!confirm("Hapus?")) return;
    const res = await mutateProgramStudiServer({ data: { action: "remove", payload: { id } } });
    if (!res.ok) return toast.error(res.error);
    toast.success("Terhapus");
    reload();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
      <Card className="md:col-span-2">
        <CardHeader><CardTitle>Daftar Program Studi</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.map(p => (
              <div key={p.id} className="flex items-center justify-between p-2 border rounded">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2"><Library className="h-4 w-4" /> {p.nama}</div>
                  <div className="text-xs text-muted-foreground ml-6">Fakultas: {fakultas.find(f => f.id === p.fakultasId)?.nama || p.fakultasId}</div>
                </div>
                <div>
                  <Button variant="ghost" size="icon" onClick={() => setForm(p)}><Edit2 className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{form.id ? "Edit" : "Tambah"} Program Studi</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nama</Label>
            <Input value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Fakultas</Label>
            <Select value={form.fakultasId} onValueChange={v => setForm({ ...form, fakultasId: v })}>
              <SelectTrigger><SelectValue placeholder="Pilih..." /></SelectTrigger>
              <SelectContent>
                {fakultas.map(f => <SelectItem key={f.id} value={f.id}>{f.nama}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button onClick={save}>Simpan</Button>
            {form.id && <Button variant="outline" onClick={() => setForm({ id: "", nama: "", fakultasId: "" })}>Batal</Button>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RombelTab({ data, prodi, reload }: { data: Rombel[], prodi: ProgramStudi[], reload: () => void }) {
  const [form, setForm] = useState({ id: "", nama: "", programStudiId: "" });

  const save = async () => {
    if (!form.nama.trim() || !form.programStudiId) return toast.error("Semua field wajib diisi!");
    const payload = { id: form.id || `r_${Date.now()}`, nama: form.nama.trim(), programStudiId: form.programStudiId } as Rombel;
    const res = await mutateRombelServer({ data: { action: "upsert", payload } });
    if (!res.ok) return toast.error(res.error);
    toast.success("Tersimpan");
    setForm({ id: "", nama: "", programStudiId: "" });
    reload();
  };

  const remove = async (id: string) => {
    if (!confirm("Hapus?")) return;
    const res = await mutateRombelServer({ data: { action: "remove", payload: { id } } });
    if (!res.ok) return toast.error(res.error);
    toast.success("Terhapus");
    reload();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
      <Card className="md:col-span-2">
        <CardHeader><CardTitle>Daftar Kelas</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.map(r => (
              <div key={r.id} className="flex items-center justify-between p-2 border rounded">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2"><Users className="h-4 w-4" /> {r.nama}</div>
                  <div className="text-xs text-muted-foreground ml-6">Prodi: {prodi.find(p => p.id === r.programStudiId)?.nama || r.programStudiId}</div>
                </div>
                <div>
                  <Button variant="ghost" size="icon" onClick={() => setForm(r)}><Edit2 className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{form.id ? "Edit" : "Tambah"} Kelas</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nama</Label>
            <Input value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Program Studi</Label>
            <Select value={form.programStudiId} onValueChange={v => setForm({ ...form, programStudiId: v })}>
              <SelectTrigger><SelectValue placeholder="Pilih..." /></SelectTrigger>
              <SelectContent>
                {prodi.map(p => <SelectItem key={p.id} value={p.id}>{p.nama}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button onClick={save}>Simpan</Button>
            {form.id && <Button variant="outline" onClick={() => setForm({ id: "", nama: "", programStudiId: "" })}>Batal</Button>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
