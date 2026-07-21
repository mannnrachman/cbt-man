import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { usersRepo, prodiRepo } from "@/lib/cbt/repos";
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
        description="Kelola akses akun admin, operator prodi, dan evaluator."
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
            <SelectItem value="admin_prodi">Admin Prodi</SelectItem>
            <SelectItem value="evaluator">Evaluator</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List Section */}
      <AdminPageContent>
        <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
          {shown.map((u) => (
            <div key={u.id} className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:px-6 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors gap-4">
              
              {/* User Info */}
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase shrink-0">
                  {u.namaLengkap.charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{u.namaLengkap}</h3>
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold tracking-wide uppercase text-slate-500">
                      {u.role === "super_admin" ? "Super Admin" : u.role === "admin_prodi" ? "Admin Prodi" : u.role === "evaluator" ? "Evaluator" : u.role}
                    </span>
                    {!u.aktif && (
                      <span className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-[10px] font-semibold tracking-wide uppercase text-red-600 dark:text-red-400">
                        Nonaktif
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-mono text-slate-500 mt-0.5 truncate">{u.username}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  onClick={() => {
                    setEditing(u);
                    setOpen(true);
                  }}
                  title="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                  title="Hapus"
                  onClick={() => {
                    if (!confirm("Hapus pengguna ini?")) return;
                    usersRepo.remove(u.id);
                    refresh();
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950"
                  title="Hentikan semua sesi aktif"
                  onClick={async () => {
                    if (!confirm("Hentikan semua sesi aktif pengguna ini? (Force logout)")) return;
                    try {
                      const res = await revokeUserSessionsServer({ data: { userId: u.id } });
                      if (res.ok) toast.success("Sesi berhasil dihentikan. Pengguna akan ter-logout.");
                      else toast.error(res.error ?? "Gagal menghentikan sesi");
                    } catch {
                      toast.error("Gagal menghentikan sesi");
                    }
                  }}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {shown.length === 0 && (
            <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              Tidak ada data pengguna yang sesuai.
            </div>
          )}
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
    prodiId: "",
    aktif: true,
    password: "",
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      username: editing?.username ?? "",
      namaLengkap: editing?.namaLengkap ?? "",
      role: editing?.role ?? "admin_prodi",
      prodiId: editing?.prodiId ?? "",
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
        groupId: editing?.groupId,
        prodiId: form.prodiId || undefined,
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
                <SelectItem value="admin_prodi">Admin Prodi</SelectItem>
                <SelectItem value="evaluator">Evaluator</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(form.role === "admin_prodi" || form.role === "mahasiswa") && (
            <div className="space-y-1">
              <Label>Program Studi</Label>
              <Select value={form.prodiId} onValueChange={(v) => setForm({ ...form, prodiId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih prodi (opsional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">-- Tidak ada --</SelectItem>
                  {prodiRepo.all().map((p) => (
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
