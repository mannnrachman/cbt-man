/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { unitAkademikRepo } from "@/lib/cbt/repos";
import type { UnitAkademik } from "@/lib/cbt/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit2, Trash2, ChevronRight, ChevronDown, Folder, Building2, Library, Users, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/akademik/")({
  component: UnitAkademikExplorer,
});

function UnitAkademikExplorer() {
  const units = unitAkademikRepo.all();
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Form State
  const [editing, setEditing] = useState<UnitAkademik | null>(null);
  const [form, setForm] = useState({ nama: "", tipe: "fakultas", parentId: "none" });

  const rootUnits = units.filter((u: UnitAkademik) => !u.parentId);

  const toggleExpand = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  const getIcon = (tipe: string) => {
    switch (tipe) {
      case "fakultas": return <Building2 className="h-4 w-4 text-blue-500" />;
      case "jurusan": return <Library className="h-4 w-4 text-purple-500" />;
      case "prodi": return <Library className="h-4 w-4 text-indigo-500" />;
      case "semester": return <Folder className="h-4 w-4 text-amber-500" />;
      case "kelas": return <Users className="h-4 w-4 text-emerald-500" />;
      default: return <Folder className="h-4 w-4 text-slate-500" />;
    }
  };

  const resetForm = () => {
    setEditing(null);
    setForm({ nama: "", tipe: "fakultas", parentId: "none" });
  };

  const save = async () => {
    if (!form.nama) return alert("Nama wajib diisi!");
    const id = editing ? editing.id : `u_${Date.now()}`;
    await unitAkademikRepo.upsert({
      id,
      nama: form.nama,
      tipe: form.tipe as any,
      parentId: form.parentId === "none" ? null : form.parentId,
    });
    resetForm();
  };

  const remove = async (id: string) => {
    if (confirm("Hapus unit ini? Unit di bawahnya mungkin akan kehilangan induk.")) {
      await unitAkademikRepo.remove(id);
      setSearch((prev) => prev); // Hack to force re-render if search doesn't change, but wait... better to use a dedicated tick
      setExpanded(new Set(expanded)); // This creates a new Set instance, forcing a re-render
    }
  };

  const renderTree = (parentIds: string[] | null, level: number = 0) => {
    const children = units
      .filter((u: UnitAkademik) => (parentIds === null ? !u.parentId : parentIds.includes(u.parentId || "")))
      .sort((a: UnitAkademik, b: UnitAkademik) => a.nama.localeCompare(b.nama));

    if (children.length === 0) return null;

    return (
      <div className="flex flex-col">
        {children.map((u: UnitAkademik) => {
          const hasChildren = units.some((child: UnitAkademik) => child.parentId === u.id);
          const isExpanded = expanded.has(u.id);

          // Filtering
          if (search && !u.nama.toLowerCase().includes(search.toLowerCase()) && !hasChildren) return null;

          return (
            <div key={u.id}>
              <div
                className={`flex items-center gap-2 rounded-md p-2 transition-colors hover:bg-accent/50 ${editing?.id === u.id ? "bg-accent" : ""}`}
                style={{ paddingLeft: `${level * 1.5 + 0.5}rem` }}
              >
                <div
                  className="flex h-6 w-6 cursor-pointer items-center justify-center rounded hover:bg-black/10 dark:hover:bg-white/10"
                  onClick={() => toggleExpand(u.id)}
                >
                  {hasChildren ? (
                    isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                  ) : (
                    <div className="h-4 w-4" />
                  )}
                </div>
                {getIcon(u.tipe)}
                <span className="flex-1 text-sm font-medium">{u.nama}</span>
                <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground uppercase">{u.tipe}</span>
                
                <div className="flex items-center gap-1 opacity-50 hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => {
                      setEditing(u);
                      setForm({ nama: u.nama, tipe: u.tipe, parentId: u.parentId || "none" });
                    }}
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => remove(u.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7" 
                    title="Tambah Sub-Unit"
                    onClick={() => {
                      setEditing(null);
                      setForm({ nama: "", tipe: "kelas", parentId: u.id });
                      const next = new Set(expanded);
                      next.add(u.id);
                      setExpanded(next);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {hasChildren && isExpanded && renderTree([u.id], level + 1)}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card className="md:col-span-2">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-4 sm:space-y-0 pb-4">
          <CardTitle>Struktur Organisasi Akademik</CardTitle>
          <Input
            placeholder="Cari unit..."
            className="max-w-xs"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              if (e.target.value) {
                setExpanded(new Set(units.map((u: UnitAkademik) => u.id)));
              } else {
                setExpanded(new Set());
              }
            }}
          />
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border bg-card p-2 min-h-[400px]">
            {units.length === 0 ? (
              <div className="flex h-[300px] flex-col items-center justify-center text-muted-foreground">
                <Folder className="mb-2 h-10 w-10 opacity-20" />
                <p>Belum ada data struktur akademik.</p>
                <Button variant="link" onClick={() => setForm({ ...form, parentId: "none" })}>Buat Induk Pertama</Button>
              </div>
            ) : (
              renderTree(null, 0)
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>{editing ? "Edit Unit" : "Tambah Unit Baru"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nama Unit</Label>
              <Input
                placeholder="Contoh: Fakultas Teknik"
                value={form.nama}
                onChange={(e) => setForm({ ...form, nama: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tipe Unit</Label>
              <Select value={form.tipe} onValueChange={(val) => setForm({ ...form, tipe: val })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fakultas">Fakultas</SelectItem>
                  <SelectItem value="jurusan">Jurusan</SelectItem>
                  <SelectItem value="semester">Semester</SelectItem>
                  <SelectItem value="kelas">Kelas / Group</SelectItem>
                  <SelectItem value="kategori_bebas">Kategori Bebas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Induk Unit (Parent)</Label>
              <Select value={form.parentId} onValueChange={(val) => setForm({ ...form, parentId: val })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Sebagai Induk (Root) --</SelectItem>
                  {units.map((u: UnitAkademik) => (
                    <SelectItem key={u.id} value={u.id}>{u.nama} ({u.tipe})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex gap-2 pt-2">
              <Button onClick={save} className="flex-1">{editing ? "Simpan Perubahan" : "Tambahkan"}</Button>
              {editing && <Button variant="outline" onClick={resetForm}>Batal</Button>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

