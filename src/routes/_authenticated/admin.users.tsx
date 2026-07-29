import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { revokeUserSessionsServer, upsertUserServer, getUsersList, mutateUserServer } from "@/lib/server/users/functions";
import { getUnitAkademikList } from "@/lib/server/akademik/functions";
import { uid } from "@/lib/cbt/storage";
import type { Role, User, UnitAkademik } from "@/lib/cbt/types";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AdminPage, AdminPageHeader, AdminPageContent } from "@/components/cbt/AdminPage";
import { Pencil, Trash2, Plus, LogOut, Search, FileX, Loader2, ChevronLeft, ChevronRight, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: UsersPage,
  loader: async () => {
    const [allUsers, units] = await Promise.all([
      getUsersList(),
      getUnitAkademikList()
    ]);
    return { allUsers, units };
  }
});

function UsersPage() {
  const { allUsers, units } = Route.useLoaderData();
  const router = useRouter();
  
  // NOTE: Server-side pagination is recommended for large datasets.
  const users = (allUsers as User[]).filter((u: User) => u.role !== "mahasiswa");

  const [editing, setEditing] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [logoutId, setLogoutId] = useState<string | null>(null);
  
  const [query, setQuery] = useState("");
  const [filterRole, setFilterRole] = useState("all");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  function refresh() {
    router.invalidate();
  }

  const filtered = users.filter((u) => 
    (filterRole === "all" || u.role === filterRole) &&
    (query === "" || u.namaLengkap.toLowerCase().includes(query.toLowerCase()) || u.username.toLowerCase().includes(query.toLowerCase()))
  );

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const shown = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [query, filterRole]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(Math.max(1, totalPages));
  }, [currentPage, totalPages]);

  async function confirmDelete() {
    if (!deleteId) return;
    const res = await mutateUserServer({ data: { action: "remove", payload: { id: deleteId } } });
    if (res.ok) {
      toast.success("Pengguna berhasil dihapus");
      refresh();
    } else {
      toast.error(res.error ?? "Gagal menghapus pengguna");
    }
    setDeleteId(null);
  }

  async function confirmLogout() {
    if (!logoutId) return;
    try {
      const res = await revokeUserSessionsServer({ data: { userId: logoutId } });
      if (res.ok) {
        toast.success("Sesi berhasil dihentikan. Pengguna akan ter-logout.");
      } else {
        toast.error(res.error ?? "Gagal menghentikan sesi");
      }
    } catch {
      toast.error("Terjadi kesalahan sistem saat menghentikan sesi");
    } finally {
      setLogoutId(null);
    }
  }

  return (
    <AdminPage>
      <AdminPageHeader
        title="Pengguna Sistem"
        description="Kelola akses akun admin, admin jurusan, dan evaluator."
        action={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm" className="h-9">
              <Link to="/admin/users/roles">
                <ShieldCheck className="mr-2 h-4 w-4" /> Hak Akses Role
              </Link>
            </Button>
            <Button onClick={() => { setEditing(null); setOpen(true); }} size="sm" className="h-9">
              <Plus className="mr-2 h-4 w-4" /> Tambah Akun
            </Button>
          </div>
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
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Semua Peran" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Peran</SelectItem>
            <SelectItem value="super_admin">Super Admin</SelectItem>
            <SelectItem value="admin_prodi">Admin Jurusan</SelectItem>
            <SelectItem value="evaluator">Evaluator</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <AdminPageContent className="p-0">
        <Card className="border-0 shadow-none sm:border sm:shadow-sm">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50 dark:bg-slate-900/50">
                  <TableHead className="font-semibold text-slate-700 dark:text-slate-300">Username</TableHead>
                  <TableHead className="font-semibold text-slate-700 dark:text-slate-300">Nama Lengkap</TableHead>
                  <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-center">Peran</TableHead>
                  <TableHead className="font-semibold text-slate-700 dark:text-slate-300">Unit / Jurusan</TableHead>
                  <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-center">Status</TableHead>
                  <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-center">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((u) => (
                  <TableRow key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                    <TableCell className="font-medium text-slate-900 dark:text-slate-100">{u.username}</TableCell>
                    <TableCell className="text-slate-600 dark:text-slate-400">{u.namaLengkap}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-slate-50 dark:bg-slate-900 font-medium">
                        {u.role === "super_admin" ? "Super Admin" : u.role === "admin_prodi" ? "Admin Jurusan" : u.role === "evaluator" ? "Evaluator" : u.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600 dark:text-slate-400">
                      {u.role === "super_admin" ? "Semua Unit (Global)" : units.find((unit) => unit.id === u.unitId)?.nama ?? "Tanpa Unit"}
                    </TableCell>
                    <TableCell className="text-center">
                      {u.aktif ? (
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
                        <Button variant="outline" size="sm" onClick={() => { setEditing(u); setOpen(true); }} className="h-8 w-8 p-0">
                          <Pencil className="h-4 w-4 text-slate-500" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setLogoutId(u.id)} className="h-8 w-8 p-0 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/50 hover:text-amber-600">
                          <LogOut className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteId(u.id)} className="h-8 w-8 p-0 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-600">
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
                        <p>Tidak ada data pengguna yang sesuai.</p>
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
                  Menampilkan {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filtered.length)} dari {filtered.length} admin
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

      <UserDialog open={open} onOpenChange={setOpen} editing={editing} onSaved={refresh} units={units} />

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-rose-600 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Hapus Pengguna
            </DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus akun admin ini secara permanen?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Batal</Button>
            <Button variant="destructive" onClick={confirmDelete}>Hapus Permanen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Force Logout Confirmation Dialog */}
      <Dialog open={!!logoutId} onOpenChange={(v) => !v && setLogoutId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-amber-600 flex items-center gap-2">
              <LogOut className="h-5 w-5" />
              Hentikan Sesi
            </DialogTitle>
            <DialogDescription>
              Aksi ini akan mengeluarkan (*force logout*) pengguna ini dari semua perangkat yang sedang terhubung. Lanjutkan?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setLogoutId(null)}>Batal</Button>
            <Button onClick={confirmLogout} className="bg-amber-600 hover:bg-amber-700 text-white">Hentikan Sesi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </AdminPage>
  );
}

function UserDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
  units,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: User | null;
  onSaved: (user: User) => void;
  units: UnitAkademik[];
}) {
  const [form, setForm] = useState({
    username: "",
    namaLengkap: "",
    role: "admin_prodi" as Role,
    unitId: "",
    aktif: true,
    password: "",
  });

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      username: editing?.username ?? "",
      namaLengkap: editing?.namaLengkap ?? "",
      role: editing?.role ?? "admin_prodi",
      unitId: editing?.unitId ?? "none",
      aktif: editing?.aktif ?? true,
      password: "",
    });
  }, [editing, open]);

  async function save() {
    if (!form.username.trim() || !form.namaLengkap.trim()) {
      toast.error("Username dan nama wajib diisi");
      return;
    }

    setIsSaving(true);
    try {
      const res = await upsertUserServer({
        data: {
          id: editing?.id ?? uid("u_"),
          username: form.username.trim(),
          namaLengkap: form.namaLengkap.trim(),
          role: form.role,
          aktif: form.aktif,
          allowedTopikIds: editing?.allowedTopikIds ?? [],
          unitId: form.unitId === "none" || !form.unitId ? undefined : form.unitId,
          detail: editing?.detail,
          createdAt: editing?.createdAt ?? Date.now(),
          newPassword: form.password.trim() || undefined,
        },
      });

      if (!res.ok) {
        toast.error(res.error ?? "Gagal menyimpan pengguna");
        return;
      }

      toast.success(editing ? "Pengguna diperbarui" : "Pengguna ditambahkan");
      onSaved(res.user);
      onOpenChange(false);
    } catch (e) {
      toast.error("Terjadi kesalahan sistem saat menyimpan");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Pengguna" : "Pengguna Baru"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Username</Label>
            <Input 
              placeholder="Masukkan username"
              value={form.username} 
              onChange={(e) => setForm({ ...form, username: e.target.value })} 
            />
          </div>
          <div className="space-y-2">
            <Label>Nama lengkap</Label>
            <Input
              placeholder="Masukkan nama lengkap"
              value={form.namaLengkap}
              onChange={(e) => setForm({ ...form, namaLengkap: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as Role })}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih hak akses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="super_admin">Super Admin</SelectItem>
                <SelectItem value="admin_prodi">Admin Jurusan</SelectItem>
                <SelectItem value="evaluator">Evaluator</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(form.role === "admin_prodi" || form.role === "mahasiswa") && (
            <div className="space-y-2">
              <Label>Unit Akademik (Opsional)</Label>
              <Select value={form.unitId} onValueChange={(v) => setForm({ ...form, unitId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih unit (opsional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">(Tidak Ada Unit)</SelectItem>
                  {units.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nama}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label>{editing ? "Password baru (kosongkan jika tidak diubah)" : "Password"}</Label>
            <Input
              type="password"
              placeholder={editing ? "Biarkan kosong jika tidak ingin mengubah" : "Masukkan password default"}
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
