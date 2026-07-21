import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { usersRepo, groupsRepo } from "@/lib/cbt/repos";
import { hashPassword } from "@/lib/cbt/hash";
import { upsertUserServer } from "@/lib/server/users/functions";
import { uid } from "@/lib/cbt/storage";
import type { Group, User } from "@/lib/cbt/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Trash2, Plus, Printer, Upload, Users as UsersIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/peserta/")({
  component: PesertaPage,
});

type PesertaWithPwd = User & { _initialPassword?: string };

function PesertaPage() {
  const [peserta, setPeserta] = useState<PesertaWithPwd[]>(
    usersRepo.all().filter((u) => u.role === "mahasiswa"),
  );
  const [groups, setGroups] = useState<Group[]>(groupsRepo.all());
  const [editing, setEditing] = useState<PesertaWithPwd | null>(null);
  const [open, setOpen] = useState(false);
  const [filterGroup, setFilterGroup] = useState<string>("all");
  const [query, setQuery] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function refresh() {
    setPeserta(usersRepo.all().filter((u) => u.role === "mahasiswa"));
    setGroups(groupsRepo.all());
  }

  const shown = peserta.filter((p) =>
    (filterGroup === "all" || p.groupId === filterGroup) &&
    (query === "" || p.namaLengkap.toLowerCase().includes(query.toLowerCase()) || p.username.toLowerCase().includes(query.toLowerCase())),
  );

  async function importExcel(file: File) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    let added = 0;
    for (const r of rows) {
      const username = String(r.username ?? r.Username ?? "").trim();
      const nama = String(r.nama ?? r.Nama ?? r.namaLengkap ?? "").trim();
      const password = String(r.password ?? r.Password ?? username + "123").trim();
      const groupName = String(r.group ?? r.Group ?? r.kelas ?? "").trim();
      if (!username || !nama) continue;
      let groupId: string | undefined;
      if (groupName) {
        let g = groupsRepo.all().find((x) => x.nama.toLowerCase() === groupName.toLowerCase());
        if (!g) { g = { id: uid("g_"), nama: groupName, keterangan: "" }; groupsRepo.upsert(g); }
        groupId = g.id;
      }
      const u: PesertaWithPwd = {
        id: uid("u_"), username, namaLengkap: nama, role: "mahasiswa",
        allowedTopikIds: [], mataKuliahIds: [], groupId, aktif: true,
        passwordHash: await hashPassword(password), createdAt: Date.now(),
        _initialPassword: password,
      };
      usersRepo.upsert(u);
      added++;
    }
    toast.success(`${added} peserta diimport`);
    refresh();
  }

  function downloadTemplate() {
    const ws = XLSX.utils.json_to_sheet([
      { username: "siswa10", nama: "Contoh Siswa", password: "siswa10123", group: "XII IPA 1" },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "peserta");
    XLSX.writeFile(wb, "template-peserta.xlsx");
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Akun Peserta</h1>
          <p className="text-sm text-slate-500">
            Kelola data mahasiswa, grup kelas, dan cetak kartu ujian.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input id="file-upload" type="file" accept=".xlsx,.xls" hidden onChange={(e) => {
            const f = e.target.files?.[0]; if (f) importExcel(f); e.target.value = "";
          }} />
          <Button variant="outline" size="sm" onClick={() => document.getElementById("file-upload")?.click()} className="h-9">
            <Upload className="mr-2 h-4 w-4" /> Import Excel
          </Button>
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1"></div>
          <Link to="/admin/peserta/group">
            <Button variant="outline" size="sm" className="h-9">
              <UsersIcon className="mr-2 h-4 w-4" /> Grup Kelas
            </Button>
          </Link>
          <Link to="/admin/peserta/kartu">
            <Button variant="outline" size="sm" className="h-9">
              <Printer className="mr-2 h-4 w-4" /> Cetak Kartu
            </Button>
          </Link>
          <Button onClick={() => { setEditing(null); setOpen(true); }} size="sm" className="h-9">
            <Plus className="mr-2 h-4 w-4" /> Tambah Peserta
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Input 
          placeholder="Cari nama atau username..." 
          value={query} 
          onChange={(e) => setQuery(e.target.value)} 
          className="max-w-xs" 
        />
        <Select value={filterGroup} onValueChange={setFilterGroup}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="Semua Grup" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Grup</SelectItem>
            {groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.nama}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* List Section */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden shadow-sm">
        
        <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
          {shown.map((p) => (
            <div key={p.id} className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:px-6 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors gap-4">
              
              {/* User Info */}
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold uppercase">
                  {p.namaLengkap.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{p.namaLengkap}</h3>
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold tracking-wide text-slate-500">
                      Grup: {groups.find((g) => g.id === p.groupId)?.nama ?? "-"}
                    </span>
                    {!p.aktif && (
                      <span className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-[10px] font-semibold tracking-wide uppercase text-red-600 dark:text-red-400">
                        Nonaktif
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-mono text-slate-500 mt-0.5">{p.username}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  onClick={() => {
                    setEditing(p);
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
                    if (!confirm("Hapus peserta ini?")) return;
                    usersRepo.remove(p.id);
                    refresh();
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {shown.length === 0 && (
            <div className="py-12 text-center text-slate-400 text-sm">
              Tidak ada data peserta yang sesuai.
            </div>
          )}
        </div>
      </div>

      <PesertaDialog open={open} onOpenChange={setOpen} editing={editing} groups={groups} onSaved={refresh} />
    </div>
  );
}

function PesertaDialog({
  open,
  onOpenChange,
  editing,
  groups,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: User | null;
  groups: Group[];
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    username: "",
    namaLengkap: "",
    groupId: "",
    aktif: true,
    password: "",
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      username: editing?.username ?? "",
      namaLengkap: editing?.namaLengkap ?? "",
      groupId: editing?.groupId ?? "",
      aktif: editing?.aktif ?? true,
      password: "",
    });
  }, [editing, open]);

  async function save() {
    if (!form.username.trim() || !form.namaLengkap.trim()) {
      toast.error("Wajib diisi");
      return;
    }

    const res = await upsertUserServer({
      data: {
        id: editing?.id ?? uid("u_"),
        username: form.username.trim(),
        namaLengkap: form.namaLengkap.trim(),
        role: "mahasiswa",
        allowedTopikIds: editing?.allowedTopikIds ?? [],
        groupId: form.groupId || undefined,
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

    usersRepo.upsert(res.user);
    toast.success("Disimpan");
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Peserta" : "Peserta Baru"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Username</Label>
            <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          </div>
          <div>
            <Label>Nama lengkap</Label>
            <Input
              value={form.namaLengkap}
              onChange={(e) => setForm({ ...form, namaLengkap: e.target.value })}
            />
          </div>
          <div>
            <Label>Group</Label>
            <Select value={form.groupId} onValueChange={(v) => setForm({ ...form, groupId: v })}>
              <SelectTrigger>
                <SelectValue placeholder="(tanpa group)" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.nama}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{editing ? "Password baru (opsional)" : "Password"}</Label>
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
