import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { usersRepo, unitAkademikRepo } from "@/lib/cbt/repos";
import { hashPassword } from "@/lib/cbt/hash";
import { upsertUserServer } from "@/lib/server/users/functions";
import { uid } from "@/lib/cbt/storage";
import type { UnitAkademik, User } from "@/lib/cbt/types";
import { Card, CardContent } from "@/components/ui/card";
import { AdminPage, AdminPageHeader, AdminPageContent } from "@/components/cbt/AdminPage";
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
  const [units, setUnits] = useState<UnitAkademik[]>(unitAkademikRepo.all());
  const [editing, setEditing] = useState<PesertaWithPwd | null>(null);
  const [open, setOpen] = useState(false);
  const [filterUnit, setFilterUnit] = useState<string>("all");
  const [query, setQuery] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function refresh() {
    setPeserta(usersRepo.all().filter((u) => u.role === "mahasiswa"));
    setUnits(unitAkademikRepo.all());
  }

  const shown = peserta.filter((p) =>
    (filterUnit === "all" || p.unitId === filterUnit) &&
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
      const unitName = String(r.group ?? r.Group ?? r.kelas ?? r.unit ?? "").trim();
      let unitId: string | undefined;
      if (unitName) {
        let g = unitAkademikRepo.all().find((x) => x.nama.toLowerCase() === unitName.toLowerCase());
        if (!g) { g = { id: uid("u_"), nama: unitName, tipe: "kelas", parentId: null }; unitAkademikRepo.upsert(g); }
        unitId = g.id;
      }
      const u: PesertaWithPwd = {
        id: uid("u_"), username, namaLengkap: nama, role: "mahasiswa",
        allowedTopikIds: [], mataKuliahIds: [], unitId, aktif: true,
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
        <AdminPage>
      <AdminPageHeader
        title="Akun Peserta"
        description="Kelola data mahasiswa, grup kelas, dan import akun dari Excel."
        action={
          <>
            <input id="file-upload" type="file" accept=".xlsx,.xls" hidden onChange={(e) => {
              const f = e.target.files?.[0]; if (f) importExcel(f); e.target.value = "";
            }} />
            <Button variant="outline" size="sm" onClick={() => document.getElementById("file-upload")?.click()} className="h-9">
              <Upload className="mr-2 h-4 w-4" /> Import Excel
            </Button>
            <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1"></div>
            <Link to="/admin/peserta/kartu">
              <Button variant="outline" size="sm" className="h-9">
                <UsersIcon className="mr-2 h-4 w-4" /> Unit Akademik
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

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Input 
          placeholder="Cari nama atau username..." 
          value={query} 
          onChange={(e) => setQuery(e.target.value)} 
          className="max-w-xs" 
        />
        <Select value={filterUnit} onValueChange={setFilterUnit}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Pilih Unit" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Unit</SelectItem>
            {units.map((g) => <SelectItem key={g.id} value={g.id}>{g.nama}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* List Section */}
      <AdminPageContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-semibold">
              <tr>
                <th className="p-4 font-semibold text-slate-700 dark:text-slate-300 text-left">Username</th>
                <th className="p-4 font-semibold text-slate-700 dark:text-slate-300 text-left">Nama Lengkap</th>
                <th className="p-4 font-semibold text-slate-700 dark:text-slate-300 text-center">Grup / Kelas</th>
                <th className="p-4 font-semibold text-slate-700 dark:text-slate-300 text-center">Status</th>
                <th className="p-4 font-semibold text-slate-700 dark:text-slate-300 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id} className="transition-colors border-t border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="p-4 font-medium text-slate-900 dark:text-slate-100 text-left">{p.username}</td>
                  <td className="p-4 text-slate-600 dark:text-slate-400 text-left">{p.namaLengkap}</td>
                  <td className="p-4 text-center">
                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {units.find((g) => g.id === p.unitId)?.nama ?? "-"}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    {p.aktif ? (
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">Aktif</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">Nonaktif</span>
                    )}
                  </td>
                  <td className="p-4 text-center space-x-2">
                    <Button variant="outline" size="sm" onClick={() => { setEditing(p); setOpen(true); }} className="h-8">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 text-destructive hover:bg-destructive/10" onClick={() => {
                      if (confirm("Hapus peserta ini?")) {
                        usersRepo.remove(p.id);
                        refresh();
                      }
                    }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">Tidak ada data peserta yang sesuai.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </AdminPageContent>
<PesertaDialog open={open} onOpenChange={setOpen} editing={editing} units={units} onSaved={refresh} />
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
    aktif: true,
    password: "",
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      username: editing?.username ?? "",
      namaLengkap: editing?.namaLengkap ?? "",
      unitId: editing?.unitId ?? "",
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
        unitId: form.unitId || undefined,
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
            <Label>Unit Akademik</Label>
            <Select value={form.unitId} onValueChange={(v) => setForm({ ...form, unitId: v })}>
              <SelectTrigger>
                <SelectValue placeholder="(tanpa unit)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">-- Tidak ada --</SelectItem>
                {units.map((g) => (<SelectItem key={g.id} value={g.id}>
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
