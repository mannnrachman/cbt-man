import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { usersRepo, unitAkademikRepo } from "@/lib/cbt/repos";
import { revokeUserSessionsServer, upsertUserServer } from "@/lib/server/users/functions";
import { uid } from "@/lib/cbt/storage";
import type { Role, User } from "@/lib/cbt/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, Trash2, Plus, LogOut } from "lucide-react";
import { toast } from "sonner";
import { AdminPage, AdminPageHeader, AdminPageContent } from "@/components/cbt/AdminPage";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: UsersPage,
});

function UsersPage() {
  const [users, setUsers] = useState<User[]>(usersRepo.all().filter((u) => u.role !== "mahasiswa"));
  const [editing, setEditing] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filterRole, setFilterRole] = useState("all");

  function refresh() {
    setUsers(usersRepo.all().filter((u) => u.role !== "mahasiswa"));
  }

  const shown = users.filter((u) => 
    (filterRole === "all" || u.role === filterRole) &&
    (query === "" || u.namaLengkap.toLowerCase().includes(query.toLowerCase()) || u.username.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <AdminPage>
      <AdminPageHeader
        title="Pengguna Sistem"
        description="Kelola akses akun admin, admin jurusan, dan evaluator."
        action={
          <Button onClick={() => { setEditing(null); setOpen(true); }} className="h-9">
            <Plus className="mr-2 h-4 w-4" /> Tambah Akun
          </Button>
        }
      />

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Input 
          placeholder="Cari nama atau username..." 
          value={query} 
          onChange={(e) => setQuery(e.target.value)} 
          className="max-w-xs" 
        />
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

      {/* List Section */}
            <AdminPageContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-semibold">
              <tr>
                <th className="p-4 font-semibold text-slate-700 dark:text-slate-300 text-left border-r border-slate-200 dark:border-slate-800">Username</th>
                <th className="p-4 font-semibold text-slate-700 dark:text-slate-300 text-left border-r border-slate-200 dark:border-slate-800">Nama Lengkap</th>
                <th className="p-4 font-semibold text-slate-700 dark:text-slate-300 text-center border-r border-slate-200 dark:border-slate-800">Peran</th>
                <th className="p-4 font-semibold text-slate-700 dark:text-slate-300 text-center border-r border-slate-200 dark:border-slate-800">Status</th>
                <th className="p-4 font-semibold text-slate-700 dark:text-slate-300 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((u) => (
                <tr key={u.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="p-4 font-medium text-slate-900 dark:text-slate-100 border-r border-slate-200 dark:border-slate-800 text-left">{u.username}</td>
                  <td className="p-4 text-slate-600 dark:text-slate-400 border-r border-slate-200 dark:border-slate-800 text-left">{u.namaLengkap}</td>
                  <td className="p-4 text-center border-r border-slate-200 dark:border-slate-800">
                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {u.role === "super_admin" ? "Super Admin" : u.role === "admin_prodi" ? "Admin Jurusan" : u.role === "evaluator" ? "Evaluator" : u.role}
                    </span>
                  </td>
                  <td className="p-4 text-center border-r border-slate-200 dark:border-slate-800">
                    {u.aktif ? (
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">Aktif</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">Nonaktif</span>
                    )}
                  </td>
                  <td className="p-4 text-center space-x-2">
                    <Button variant="outline" size="sm" onClick={() => { setEditing(u); setOpen(true); }} className="h-8">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 text-destructive hover:bg-destructive/10" onClick={() => {
                      if (confirm("Hapus pengguna ini?")) {
                        usersRepo.remove(u.id);
                        refresh();
                      }
                    }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950" onClick={async () => {
                      if (!confirm("Hentikan semua sesi aktif pengguna ini? (Force logout)")) return;
                      try {
                        const res = await revokeUserSessionsServer({ data: { userId: u.id } });
                        if (res.ok) toast.success("Sesi berhasil dihentikan. Pengguna akan ter-logout.");
                        else toast.error(res.error ?? "Gagal menghentikan sesi");
                      } catch {
                        toast.error("Gagal menghentikan sesi");
                      }
                    }}>
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">Tidak ada data pengguna.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </AdminPageContent>

      <UserDialog open={open} onOpenChange={setOpen} editing={editing} onSaved={refresh} />
    </AdminPage>
  );
}

function UserDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: User | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    username: "",
    namaLengkap: "",
    role: "admin_prodi" as Role,
    unitId: "",
    aktif: true,
    password: "",
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      username: editing?.username ?? "",
      namaLengkap: editing?.namaLengkap ?? "",
      role: editing?.role ?? "admin_prodi",
      unitId: editing?.unitId ?? "",
      aktif: editing?.aktif ?? true,
      password: "",
    });
  }, [editing, open]);

  async function save() {
    if (!form.username.trim() || !form.namaLengkap.trim()) {
      toast.error("Username dan nama wajib diisi");
      return;
    }

    const res = await upsertUserServer({
      data: {
        id: editing?.id ?? uid("u_"),
        username: form.username.trim(),
        namaLengkap: form.namaLengkap.trim(),
        role: form.role,
        aktif: form.aktif,
        allowedTopikIds: editing?.allowedTopikIds ?? [],
        unitId: form.unitId || undefined,
        detail: editing?.detail,
        createdAt: editing?.createdAt ?? Date.now(),
        newPassword: form.password.trim() || undefined,
      },
    });

    if (!res.ok) {
      toast.error(res.error ?? "Gagal menyimpan pengguna");
      return;
    }

    usersRepo.upsert(res.user);
    toast.success(editing ? "Pengguna diperbarui" : "Pengguna ditambahkan");
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Pengguna" : "Pengguna Baru"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Username</Label>
            <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Nama lengkap</Label>
            <Input
              value={form.namaLengkap}
              onChange={(e) => setForm({ ...form, namaLengkap: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>Role</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as Role })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="super_admin">Super Admin</SelectItem>
                <SelectItem value="admin_prodi">Admin Jurusan</SelectItem>
                <SelectItem value="evaluator">Evaluator</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(form.role === "admin_prodi" || form.role === "mahasiswa") && (
            <div>
              <Label>Unit Akademik (Opsional)</Label>
              <Select value={form.unitId} onValueChange={(v) => setForm({ ...form, unitId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih unit (opsional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">(Tidak Ada Unit)</SelectItem>
                  {unitAkademikRepo.all().map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nama}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1">
            <Label>{editing ? "Password baru (kosongkan jika tidak diubah)" : "Password"}</Label>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={save}>Simpan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
