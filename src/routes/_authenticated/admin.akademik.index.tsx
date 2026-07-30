import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { unitAkademikRepo, hydrateRepos } from "@/lib/cbt/repos";
import { mutateUnitAkademikServer } from "@/lib/server/akademik/functions";
import type { UnitAkademik } from "@/lib/cbt/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit2, Trash2, ChevronRight, ChevronDown, Folder, Building2, Library, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/akademik/")({
  component: UnitAkademikExplorer,
});

function getDescendantIds(targetId: string, units: UnitAkademik[]): Set<string> {
  const set = new Set<string>();
  const addChildren = (parentId: string) => {
    for (const u of units) {
      if (u.parentId === parentId && !set.has(u.id)) {
        set.add(u.id);
        addChildren(u.id);
      }
    }
  };
  addChildren(targetId);
  return set;
}

function highlightText(text: string, query: string) {
  const safeText = text || "";
  if (!query.trim()) return safeText;
  const parts = safeText.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="bg-amber-200 dark:bg-amber-900/80 dark:text-amber-100 font-semibold px-0.5 rounded">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

function UnitAkademikExplorer() {
  const [units, setUnits] = useState<UnitAkademik[]>(unitAkademikRepo.all());
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [isAddingRoot, setIsAddingRoot] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let isMounted = true;
    hydrateRepos().then(() => {
      if (isMounted) {
        setUnits([...unitAkademikRepo.all()]);
      }
    }).catch(() => undefined);
    return () => { isMounted = false; };
  }, []);

  const selectedUnit = selectedUnitId ? units.find((u: UnitAkademik) => u.id === selectedUnitId) || null : null;

  // Form State
  const [editing, setEditing] = useState<UnitAkademik | null>(null);
  const [form, setForm] = useState({ nama: "", tipe: "fakultas", parentId: "none" });

  const filteredMatchCount = search.trim()
    ? units.filter((u: UnitAkademik) => (u.nama || "").toLowerCase().includes(search.toLowerCase())).length
    : units.length;

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
    setIsAddingRoot(false);
    setForm({ nama: "", tipe: "fakultas", parentId: "none" });
  };

  const save = async () => {
    if (!form.nama.trim()) {
      toast.error("Nama unit wajib diisi!");
      return;
    }
    const id = editing ? editing.id : `u_${Date.now()}`;
    const payload: UnitAkademik = {
      id,
      nama: form.nama.trim(),
      tipe: form.tipe as UnitAkademik["tipe"],
      parentId: form.parentId === "none" ? null : form.parentId,
    };

    const res = await mutateUnitAkademikServer({ data: { action: "upsert", payload } });
    if (!res.ok) {
      toast.error(res.error || "Gagal menyimpan unit ke server");
      return;
    }

    unitAkademikRepo.upsert(payload);
    setUnits([...unitAkademikRepo.all()]);
    toast.success(editing ? "Unit Akademik diperbarui" : "Unit Akademik ditambahkan");
    resetForm();
  };

  const remove = async (id: string) => {
    const hasChildren = units.some((u: UnitAkademik) => u.parentId === id);
    if (hasChildren) {
      toast.error("Tidak dapat menghapus unit ini karena masih memiliki sub-unit di bawahnya.");
      return;
    }

    if (!confirm("Hapus unit akademik ini?")) return;

    const res = await mutateUnitAkademikServer({ data: { action: "remove", payload: { id } } });
    if (!res.ok) {
      toast.error(res.error || "Gagal menghapus unit");
      return;
    }

    unitAkademikRepo.remove(id);
    setUnits([...unitAkademikRepo.all()]);
    toast.success("Unit Akademik dihapus");
  };

  const invalidParentIds = editing ? getDescendantIds(editing.id, units).add(editing.id) : new Set<string>();
  const allowedParentUnits = units.filter((u: UnitAkademik) => !invalidParentIds.has(u.id));

  const renderTree = (parentIds: string[] | null, level: number = 0) => {
    const children = units
      .filter((u: UnitAkademik) => (parentIds === null ? !u.parentId : parentIds.includes(u.parentId || "")))
      .sort((a: UnitAkademik, b: UnitAkademik) => (a.nama || "").localeCompare(b.nama || ""));

    if (children.length === 0) return null;

    return (
      <div className="flex flex-col">
        {children.map((u: UnitAkademik) => {
          const hasChildren = units.some((child: UnitAkademik) => child.parentId === u.id);
          const isExpanded = expanded.has(u.id);
          const isAddingChild = !editing && form.parentId === u.id;

          // Filtering
          if (search && !(u.nama || "").toLowerCase().includes(search.toLowerCase()) && !hasChildren) return null;

          return (
            <div key={u.id}>
              <div
                className={`flex items-center gap-2 rounded-md p-2 transition-colors cursor-pointer ${
                  selectedUnit?.id === u.id
                    ? "bg-primary/10 border-l-2 border-primary font-semibold text-foreground"
                    : editing?.id === u.id
                    ? "bg-accent"
                    : "hover:bg-accent/50"
                }`}
                style={{ paddingLeft: `${level * 1.5 + 0.5}rem` }}
                onClick={() => setSelectedUnitId(prev => prev === u.id ? null : u.id)}
              >
                <div
                  className="flex h-6 w-6 cursor-pointer items-center justify-center rounded hover:bg-black/10 dark:hover:bg-white/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpand(u.id);
                  }}
                >
                  {(hasChildren || isAddingChild) ? (
                    isExpanded ? <ChevronDown className="h-4 w-4 text-primary" /> : <ChevronRight className="h-4 w-4" />
                  ) : (
                    <div className="h-4 w-4" />
                  )}
                </div>
                {getIcon(u.tipe)}
                <span className="flex-1 text-sm font-medium">{highlightText(u.nama, search)}</span>
                <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground uppercase">{u.tipe}</span>
                
                <div className="flex items-center gap-1 opacity-50 hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => {
                      setEditing(u);
                      setSelectedUnitId(u.id);
                      setForm({ nama: u.nama, tipe: u.tipe, parentId: u.parentId || "none" });
                      setTimeout(() => inputRef.current?.focus(), 50);
                    }}
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => {
                    remove(u.id);
                    if (selectedUnitId === u.id) setSelectedUnitId(null);
                  }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7" 
                    title="Tambah Sub-Unit"
                    onClick={() => {
                      setEditing(null);
                      setSelectedUnitId(u.id);
                      const nextType = u.tipe === "fakultas" ? "prodi" : "kelas";
                      setForm({ nama: "", tipe: nextType, parentId: u.id });
                      const next = new Set(expanded);
                      next.add(u.id);
                      setExpanded(next);
                      setTimeout(() => inputRef.current?.focus(), 50);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Inline Sub-unit Input Form & Children */}
              {isExpanded && (
                <div className="flex flex-col">
                  {isAddingChild && (
                    <div 
                      className="flex items-center gap-2 rounded-md p-2 bg-primary/10 border border-primary/30 my-1 animate-in fade-in slide-in-from-top-1 duration-150"
                      style={{ paddingLeft: `${(level + 1) * 1.5 + 0.5}rem` }}
                    >
                      <div className="h-4 w-4 flex items-center justify-center text-primary font-bold">↳</div>
                      {getIcon(form.tipe)}
                      <Input
                        ref={inputRef}
                        placeholder={form.tipe === "prodi" ? "Nama Program Studi..." : "Nama Kelas / Angkatan..."}
                        className="h-8 text-sm flex-1 bg-background"
                        value={form.nama}
                        onChange={(e) => setForm({ ...form, nama: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") save();
                          if (e.key === "Escape") resetForm();
                        }}
                      />
                      <Button size="sm" className="h-8 px-3 text-xs" onClick={save}>Simpan</Button>
                      <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={resetForm}>Batal</Button>
                    </div>
                  )}

                  {renderTree([u.id], level + 1)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Tree Explorer (7 Cols) */}
      <Card className="lg:col-span-7">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-4 sm:space-y-0 pb-4">
          <CardTitle className="text-base font-bold">Struktur Unit Akademik</CardTitle>
          <div className="flex items-center gap-2 max-w-sm w-full sm:w-auto">
            {search.trim() !== "" && (
              <span className="text-xs text-muted-foreground whitespace-nowrap bg-muted px-2.5 py-1 rounded-md font-medium border">
                {filteredMatchCount} / {units.length} unit
              </span>
            )}
            <Input
              placeholder="Cari unit..."
              className="max-w-xs h-8 text-xs"
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
            <Button
              size="sm"
              className="gap-1 px-2.5 h-8 text-xs whitespace-nowrap"
              onClick={() => {
                setEditing(null);
                setSelectedUnitId(null);
                setIsAddingRoot(true);
                setForm({ nama: "", tipe: "fakultas", parentId: "none" });
                setTimeout(() => inputRef.current?.focus(), 50);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              Tambah Fakultas
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border bg-card p-2 min-h-[420px]">
            {/* Inline Root Adding Form */}
            {!editing && isAddingRoot && (
              <div className="flex items-center gap-2 rounded-md p-2 bg-primary/10 border border-primary/30 mb-3 animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="h-4 w-4 flex items-center justify-center text-primary font-bold">+</div>
                {getIcon("fakultas")}
                <Input
                  ref={inputRef}
                  placeholder="Nama Fakultas Baru..."
                  className="h-8 text-sm flex-1 bg-background"
                  value={form.nama}
                  onChange={(e) => setForm({ ...form, nama: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") save();
                    if (e.key === "Escape") resetForm();
                  }}
                />
                <Button size="sm" className="h-8 px-3 text-xs" onClick={save}>Simpan</Button>
                <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={resetForm}>Batal</Button>
              </div>
            )}

            {units.length === 0 ? (
              <div className="flex h-[300px] flex-col items-center justify-center text-muted-foreground">
                <Folder className="mb-2 h-10 w-10 opacity-20" />
                <p>Belum ada data unit akademik.</p>
                <Button variant="link" onClick={() => setForm({ ...form, parentId: "none" })}>Buat Unit Utama (Fakultas)</Button>
              </div>
            ) : (
              renderTree(null, 0)
            )}
          </div>
        </CardContent>
      </Card>

      {/* Right Column (5 Cols): Edit Form OR Detail Panel OR Guidance */}
      <div className="lg:col-span-5 space-y-4">
        {editing ? (
          <Card className="border-primary/30 shadow-xs animate-in fade-in slide-in-from-right-2 duration-200">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base font-bold">Edit Unit Akademik</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Nama Unit Akademik</Label>
                <Input
                  ref={inputRef}
                  placeholder="Contoh: Fakultas Ilmu Komputer / S1 Teknik Informatika"
                  value={form.nama}
                  onChange={(e) => setForm({ ...form, nama: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tipe Unit</Label>
                <Select value={form.tipe} onValueChange={(val) => setForm({ ...form, tipe: val })}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fakultas">Fakultas</SelectItem>
                    <SelectItem value="prodi">Program Studi / Jurusan</SelectItem>
                    <SelectItem value="kelas">Kelas / Angkatan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Unit Induk (Parent)</Label>
                <Select value={form.parentId} onValueChange={(val) => setForm({ ...form, parentId: val })}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Tanpa Induk (Fakultas / Utama) --</SelectItem>
                    {allowedParentUnits.map((u: UnitAkademik) => (
                      <SelectItem key={u.id} value={u.id}>{u.nama} ({u.tipe})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={save} className="flex-1 text-xs">Simpan Perubahan</Button>
                <Button size="sm" variant="outline" onClick={resetForm} className="text-xs">Batal</Button>
              </div>
            </CardContent>
          </Card>
        ) : selectedUnit ? (
          <Card className="border shadow-xs animate-in fade-in duration-200">
            <CardHeader className="pb-3 border-b">
              {/* Visual Breadcrumb Path */}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2 overflow-x-auto pb-1 scrollbar-none">
                {(() => {
                  const path: UnitAkademik[] = [selectedUnit];
                  let curr = selectedUnit;
                  const visited = new Set<string>([selectedUnit.id]);
                  while (curr.parentId) {
                    const p = units.find(x => x.id === curr.parentId);
                    if (p && !visited.has(p.id)) {
                      visited.add(p.id);
                      path.unshift(p);
                      curr = p;
                    } else break;
                  }
                  return path.map((item, idx) => (
                    <div key={item.id} className="flex items-center gap-1 shrink-0">
                      {idx > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/50" />}
                      <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px]", idx === path.length - 1 ? "bg-primary/10 text-primary font-semibold" : "bg-muted")}>
                        {getIcon(item.tipe)}
                        {item.nama}
                      </span>
                    </div>
                  ));
                })()}
              </div>

              <div className="flex items-center gap-3 pt-1">
                <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
                  {getIcon(selectedUnit.tipe)}
                </div>
                <div>
                  <CardTitle className="text-base font-bold">{selectedUnit.nama}</CardTitle>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                    {selectedUnit.tipe}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {/* Visual Sub-units List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Folder className="h-3.5 w-3.5 text-primary" />
                    Sub-Unit Terdaftar
                  </span>
                  <span className="text-[11px] text-primary bg-primary/10 px-2 py-0.5 rounded-full font-bold">
                    {units.filter(x => x.parentId === selectedUnit.id).length} Sub-unit
                  </span>
                </div>

                <div className="rounded-xl border bg-muted/20 p-2 max-h-52 overflow-y-auto space-y-1.5 scrollbar-thin">
                  {units.filter(x => x.parentId === selectedUnit.id).length === 0 ? (
                    <div className="py-6 text-center space-y-1">
                      <Folder className="h-6 w-6 text-muted-foreground/30 mx-auto" />
                      <p className="text-xs text-muted-foreground italic">
                        Belum ada sub-unit di bawah {selectedUnit.nama}.
                      </p>
                    </div>
                  ) : (
                    units
                      .filter(x => x.parentId === selectedUnit.id)
                      .map(child => (
                        <div key={child.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-card border text-xs shadow-2xs hover:border-primary/40 transition-colors">
                          <div className="p-1.5 rounded-md bg-muted">
                            {getIcon(child.tipe)}
                          </div>
                          <span className="font-semibold text-foreground flex-1">{child.nama}</span>
                          <span className="text-[10px] text-muted-foreground uppercase bg-muted px-2 py-0.5 rounded font-medium">
                            {child.tipe}
                          </span>
                        </div>
                      ))
                  )}
                </div>
              </div>

              {/* Direct Actions */}
              <div className="space-y-2 pt-2 border-t">
                <Button
                  size="sm"
                  className="w-full gap-2 text-xs"
                  onClick={() => {
                    setEditing(null);
                    const nextType = selectedUnit.tipe === "fakultas" ? "prodi" : "kelas";
                    setForm({ nama: "", tipe: nextType, parentId: selectedUnit.id });
                    const next = new Set(expanded);
                    next.add(selectedUnit.id);
                    setExpanded(next);
                    setTimeout(() => inputRef.current?.focus(), 50);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Tambah Sub-Unit di Bawah Ini
                </Button>
                
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs"
                    onClick={() => {
                      setEditing(selectedUnit);
                      setForm({ nama: selectedUnit.nama, tipe: selectedUnit.tipe, parentId: selectedUnit.parentId || "none" });
                      setTimeout(() => inputRef.current?.focus(), 50);
                    }}
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    Edit Unit
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="gap-1.5 text-xs"
                    onClick={() => {
                      remove(selectedUnit.id);
                      setSelectedUnitId(null);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Hapus Unit
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Clean Simple Placeholder (When nothing selected) */
          <Card className="min-h-[280px] border-dashed bg-muted/10 flex flex-col items-center justify-center text-center p-6 space-y-2">
            <Building2 className="h-8 w-8 text-muted-foreground/30 mb-1" />
            <h4 className="text-xs font-semibold text-muted-foreground">Detail Unit Akademik</h4>
            <p className="text-[11px] text-muted-foreground/70 max-w-xs leading-relaxed">
              Pilih salah satu Fakultas, Prodi, atau Kelas pada pohon hirarki di sebelah kiri untuk melihat rincian visual dan opsi aksi cepat.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

