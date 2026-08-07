import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { upsertUserServer, getUsersList, mutateUserServer } from "@/lib/server/users/functions";
import { getUnitAkademikList } from "@/lib/server/akademik/functions";
import { uid } from "@/lib/cbt/storage";
import type { UnitAkademik, User } from "@/lib/cbt/types";

import { Card, CardContent } from "@/components/ui/card";
import { AdminPage, AdminPageHeader, AdminPageContent } from "@/components/cbt/AdminPage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Plus, Printer, Upload, Users as UsersIcon, Activity, Search, Loader2, ChevronLeft, ChevronRight, FileX } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/peserta/")({
  component: PesertaPage,
  loader: async () => {
    const [allUsers, allUnits] = await Promise.all([
      getUsersList(),
      getUnitAkademikList(),
    ]);
    return { allUsers, allUnits };
  }
});

type PesertaWithPwd = User & { _initialPassword?: string };

function PesertaPage() {
  const { allUsers, allUnits } = Route.useLoaderData();
  const router = useRouter();
  
  const peserta = (allUsers as User[]).filter((u: User) => u.role === "mahasiswa");
  const units = allUnits;

  const [editing, setEditing] = useState<PesertaWithPwd | null>(null);
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [filterUnit, setFilterUnit] = useState<string>("all");
  const [query, setQuery] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  function refresh() {
    setSelectedIds([]);
    router.invalidate();
  }

  async function handleBulkDelete() {
    if (!confirm(`Hapus ${selectedIds.length} peserta terpilih secara permanen?`)) return;
    const res = await mutateUserServer({ data: { action: "bulkRemove", payload: { ids: selectedIds } } });
    if (res.ok) {
      toast.success(`${selectedIds.length} peserta berhasil dihapus`);
      refresh();
    } else {
      toast.error(res.error ?? "Gagal menghapus peserta");
    }
  }

  const filtered = peserta.filter((p) =>
    (filterUnit === "all" || p.unitId === filterUnit) &&
    (query === "" || p.namaLengkap.toLowerCase().includes(query.toLowerCase()) || p.username.toLowerCase().includes(query.toLowerCase()))
  );

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const shown = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [query, filterUnit]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(Math.max(1, totalPages));
  }, [currentPage, totalPages]);

  async function importExcel(file: File) {
    setIsImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      
      let added = 0;
      let failed = 0;
      const localUnits = [...units];
      
      for (const r of rows) {
        const username = String(r.username ?? r.Username ?? "").trim();
        const nama = String(r.nama ?? r.Nama ?? r.namaLengkap ?? "").trim();
        const password = String(r.password ?? r.Password ?? "").trim();
        const unitName = String(r.group ?? r.Group ?? r.kelas ?? r.unit ?? "").trim();
        const angkatan = String(r.angkatan ?? r.Angkatan ?? "").trim();
        if (!username || !nama || !password) {
          failed++;
          continue;
        }
        const unit = unitName
          ? localUnits.find((x: UnitAkademik) => x.nama.toLowerCase() === unitName.toLowerCase())
          : undefined;
        if (unitName && !unit) {
          failed++;
          continue;
        }
        const unitId = unit?.id;

        const existingUser = (allUsers as User[]).find((u: User) => u.username === username);
        const userId = existingUser ? existingUser.id : uid("u_");

        const res = await upsertUserServer({
          data: {
            id: userId, username, namaLengkap: nama, role: "mahasiswa",
            allowedTopikIds: existingUser ? existingUser.allowedTopikIds : [], unitId: unitId, aktif: true,
            createdAt: existingUser ? existingUser.createdAt : Date.now(), newPassword: password,
            angkatan: angkatan || (existingUser?.angkatan ?? undefined),
          }
        });
        if (res.ok) {
          added++;
        } else {
          failed++;
        }
      }
      if (failed > 0) {
        toast.warning(`${added} peserta diimport, ${failed} gagal diimport`);
      } else {
        toast.success(`${added} peserta berhasil diimport`);
      }
      refresh();
    } catch (e) {
      toast.error("Gagal memproses file Excel");
    } finally {
      setIsImporting(false);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    const res = await mutateUserServer({ data: { action: "remove", payload: { id: deleteId } } });
    if (res.ok) {
      toast.success("Peserta berhasil dihapus");
      refresh();
    } else {
      toast.error(res.error ?? "Gagal menghapus peserta");
    }
    setDeleteId(null);
  }

  return (
    <AdminPage>
      <AdminPageHeader
        title="Akun Peserta"
        description="Kelola data mahasiswa, grup kelas, dan import akun dari Excel."
        action={
          <>
            <input id="file-upload" type="file" accept=".xlsx,.xls" hidden onChange={(e) => {
              const f = e.target.files?.[0]; if (f) importExcel(f); e.target.value = "";
            }} />
            <Button variant="outline" size="sm" onClick={() => document.getElementById("file-upload")?.click()} className="h-9" disabled={isImporting}>
              {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Import Excel
            </Button>
            <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1"></div>
            <Link to="/admin/akademik">
              <Button variant="outline" size="sm" className="h-9">
                <UsersIcon className="mr-2 h-4 w-4" /> Unit Akademik
              </Button>
            </Link>
            <Link to="/admin/peserta/online">
              <Button variant="outline" size="sm" className="h-9">
                <Activity className="mr-2 h-4 w-4" /> Live Ujian
              </Button>
            </Link>
            <Link to="/admin/peserta/kartu">
              <Button variant="outline" size="sm" className="h-9">
                <Printer className="mr-2 h-4 w-4" /> Cetak Kartu
              </Button>
            </Link>
            <Button onClick={() => { setEditing(null); setOpen(true); }} size="sm" className="h-9">
              <Plus className="mr-2 h-4 w-4" /> Tambah Akun
            </Button>
          </>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
          <Input 
            placeholder="Cari nama atau username..." 
            value={query} 
            onChange={(e) => setQuery(e.target.value)} 
            className="pl-9" 
          />
        </div>
        <Select value={filterUnit} onValueChange={setFilterUnit}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Pilih Unit" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Unit</SelectItem>
            {units.map((g) => <SelectItem key={g.id} value={g.id}>{g.nama}</SelectItem>)}
          </SelectContent>
        </Select>
        {selectedIds.length > 0 && (
          <Button variant="destructive" size="sm" onClick={handleBulkDelete} className="sm:ml-auto">
            <Trash2 className="mr-2 h-4 w-4" /> Hapus Terpilih ({selectedIds.length})
          </Button>
        )}
      </div>

      <AdminPageContent className="p-0">
        <Card className="border-0 shadow-none sm:border sm:shadow-sm">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50 dark:bg-slate-900/50">
                  <TableHead className="w-12 text-center">
                    <Checkbox
                      checked={shown.length > 0 && shown.every((p) => selectedIds.includes(p.id))}
                      onCheckedChange={(checked) => setSelectedIds((ids) => {
                        const pageIds = shown.map((p) => p.id);
                        const rest = ids.filter((id) => !pageIds.includes(id));
                        return checked ? [...rest, ...pageIds] : rest;
                      })}
                      aria-label="Pilih semua peserta pada halaman ini"
                    />
                  </TableHead>
                  <TableHead className="font-semibold text-slate-700 dark:text-slate-300">Username (NIM + Angkatan)</TableHead>
                  <TableHead className="font-semibold text-slate-700 dark:text-slate-300">Nama Lengkap</TableHead>
                  <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-center">Tahun Angkatan</TableHead>
                  <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-center">Grup / Kelas</TableHead>
                  <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-center">Status</TableHead>
                  <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-center">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((p) => (
                  <TableRow key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                    <TableCell className="text-center">
                      <Checkbox
                        checked={selectedIds.includes(p.id)}
                        onCheckedChange={(checked) => setSelectedIds((ids) => checked ? [...ids, p.id] : ids.filter((id) => id !== p.id))}
                        aria-label={`Pilih ${p.namaLengkap}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium text-slate-900 dark:text-slate-100">{p.username}</TableCell>
                    <TableCell className="text-slate-600 dark:text-slate-400">{p.namaLengkap}</TableCell>
                    <TableCell className="text-center font-mono text-sm text-slate-500">{p.angkatan || "-"}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-slate-50 dark:bg-slate-900 font-medium">
                        {units.find((g) => g.id === p.unitId)?.nama ?? "-"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {p.aktif ? (
                        <Badge variant="outline" className="font-medium shadow-none border-slate-200 dark:border-slate-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2"></span>
                          Aktif
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="font-medium text-slate-500 shadow-none border-slate-200 dark:border-slate-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mr-2"></span>
                          Nonaktif
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => { setEditing(p); setOpen(true); }} className="h-8 w-8 p-0">
                          <Pencil className="h-4 w-4 text-slate-500" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteId(p.id)} className="h-8 w-8 p-0 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-600">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {shown.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center text-slate-500">
                        <FileX className="h-10 w-10 text-slate-300 dark:text-slate-600 mb-3" />
                        <p>Tidak ada data peserta yang sesuai.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-800">
                <div className="text-sm text-slate-500">
                  Menampilkan {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filtered.length)} dari {filtered.length} peserta
                </div>
                <div className="flex items-center gap-1">
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="h-8 w-8" 
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="text-sm font-medium px-2">
                    {currentPage} / {totalPages}
                  </div>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="h-8 w-8" 
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </AdminPageContent>
      
      <PesertaDialog open={open} onOpenChange={setOpen} editing={editing} units={units} onSaved={refresh} />

      <Dialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-rose-600 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Hapus Peserta
            </DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus data peserta ini? Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Batal</Button>
            <Button variant="destructive" onClick={confirmDelete}>Hapus Permanen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}

function PesertaDialog({
  open,
  onOpenChange,
  editing,
  units,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: User | null;
  units: UnitAkademik[];
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    username: "",
    namaLengkap: "",
    unitId: "",
    angkatan: "",
    aktif: true,
    password: "",
  });

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      username: editing?.username ?? "",
      namaLengkap: editing?.namaLengkap ?? "",
      unitId: editing?.unitId ?? "",
      angkatan: editing?.angkatan ?? "",
      aktif: editing?.aktif ?? true,
      password: "",
    });
  }, [editing, open]);

  async function save() {
    if (!form.username.trim() || !form.namaLengkap.trim()) {
      toast.error("Username dan Nama Lengkap wajib diisi");
      return;
    }

    setIsSaving(true);
    try {
      const res = await upsertUserServer({
        data: {
          id: editing?.id ?? uid("u_"),
          username: form.username.trim(),
          namaLengkap: form.namaLengkap.trim(),
          role: "mahasiswa",
          allowedTopikIds: editing?.allowedTopikIds ?? [],
          unitId: form.unitId === "none" ? undefined : form.unitId || undefined,
          angkatan: form.angkatan.trim() || undefined,
          detail: editing?.detail,
          aktif: form.aktif,
          createdAt: editing?.createdAt ?? Date.now(),
          newPassword: form.password.trim() || undefined,
        },
      });

      if (!res.ok) {
        toast.error(res.error ?? "Gagal menyimpan peserta");
        return;
      }

      toast.success(editing ? "Peserta berhasil diperbarui" : "Peserta baru ditambahkan");
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error("Terjadi kesalahan sistem");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Data Peserta" : "Tambah Peserta Baru"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Username (NIM + Angkatan)</Label>
              <Input 
                placeholder="Misal: 190012342025"
                value={form.username} 
                onChange={(e) => setForm({ ...form, username: e.target.value })} 
              />
            </div>
            <div className="space-y-2">
              <Label>Tahun Angkatan</Label>
              <Input 
                placeholder="Misal: 2025"
                value={form.angkatan} 
                onChange={(e) => setForm({ ...form, angkatan: e.target.value })} 
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Nama Lengkap</Label>
            <Input
              placeholder="Masukkan nama lengkap"
              value={form.namaLengkap}
              onChange={(e) => setForm({ ...form, namaLengkap: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Unit Akademik / Kelas</Label>
            <Select value={form.unitId} onValueChange={(v) => setForm({ ...form, unitId: v })}>
              <SelectTrigger>
                <SelectValue placeholder="(Tanpa Unit)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-- Tidak ada --</SelectItem>
                {units.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.nama}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{editing ? "Password Baru (Opsional)" : "Password"}</Label>
            <Input
              type="password"
              placeholder={editing ? "Kosongkan jika tidak ingin diubah" : "Masukkan password awal"}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Batal
          </Button>
          <Button onClick={save} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {editing ? "Simpan Perubahan" : "Tambahkan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
