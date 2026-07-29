import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { getUsersList, upsertUserServer } from "@/lib/server/users/functions";
import { getModulsList, getTopiksList } from "@/lib/server/modul/functions";
import { getFullConfigServer, saveConfigServer } from "@/lib/server/ujian/functions";
import { NAV_KEYS, type NavKey, type User } from "@/lib/cbt/types";
import { Card, CardContent } from "@/components/ui/card";
import { AdminPage, AdminPageHeader } from "@/components/cbt/AdminPage";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

const LABEL: Record<NavKey, string> = {
  dashboard: "Dashboard Utama",
  users: "Kelola Pengguna",
  akademik: "Data Akademik",
  peserta: "Kelola Peserta",
  modul: "Bank Soal & Modul",
  files: "File Manager (Media)",
  ujian: "Kelola Paket Ujian",
  hasil: "Hasil Ujian & Riwayat",
  evaluasi: "Evaluasi Essay",
  laporan: "Laporan & Statistik",
  leaderboard: "Leaderboard Ujian",
  pengaturan: "Pengaturan Sistem",
  tools: "Backup & Restore",
  panduan: "Panduan Pengguna",

};

export const Route = createFileRoute("/_authenticated/admin/users/roles")({
  component: RolesPage,
  loader: async () => {
    const [allUsers, moduls, topiks, config] = await Promise.all([
      getUsersList(),
      getModulsList(),
      getTopiksList(),
      getFullConfigServer(),
    ]);
    if (!config) throw new Error("Config not found");
    return { allUsers, moduls, topiks, config };
  }
});

function RolesPage() {
  const { allUsers, moduls, topiks, config } = Route.useLoaderData();
  const router = useRouter();

  const [cfg, setCfg] = useState(config);
  const adminProdiAccess = (cfg.roleAccess.admin_prodi ?? []) as NavKey[];
  const evaluatorAccess = (cfg.roleAccess.evaluator ?? []) as NavKey[];
  const managers = (allUsers as User[]).filter((u: User) => u.role === "admin_prodi" || u.role === "evaluator");

  async function toggleNav(role: "admin_prodi" | "evaluator", key: NavKey) {
    const list = (cfg.roleAccess[role] ?? []) as NavKey[];
    const has = list.includes(key);
    const next = has ? list.filter((x) => x !== key) : [...list, key];
    
    const prevConfig = cfg;
    const newConfig = { ...cfg, roleAccess: { ...cfg.roleAccess, [role]: next } };
    setCfg(newConfig);

    const res = await saveConfigServer({ data: newConfig });
    if (!res.ok) {
      toast.error(res.error || "Gagal menyimpan konfigurasi hak akses");
      setCfg(prevConfig);
    } else {
      await router.invalidate();
    }
  }

  async function toggleTopik(u: User, topikId: string) {
    const has = u.allowedTopikIds.includes(topikId);
    const res = await upsertUserServer({
      data: {
        id: u.id,
        username: u.username,
        namaLengkap: u.namaLengkap,
        role: u.role,
        allowedTopikIds: has
          ? u.allowedTopikIds.filter((x: string) => x !== topikId)
          : [...u.allowedTopikIds, topikId],
        unitId: u.unitId,
        detail: u.detail,
        aktif: u.aktif,
        createdAt: u.createdAt,
      },
    });
    if (!res.ok) {
      toast.error(res.error ?? "Gagal menyimpan hak akses topik");
      return;
    }
    toast.success("Hak akses topik disimpan");
    await router.invalidate();
  }

  async function setBulkTopik(u: User, topikIdsToToggle: string[], shouldAdd: boolean) {
    let nextTopikIds = [...u.allowedTopikIds];
    if (shouldAdd) {
      const set = new Set(nextTopikIds);
      topikIdsToToggle.forEach((id) => set.add(id));
      nextTopikIds = Array.from(set);
    } else {
      nextTopikIds = nextTopikIds.filter((id) => !topikIdsToToggle.includes(id));
    }
    const res = await upsertUserServer({
      data: {
        id: u.id,
        username: u.username,
        namaLengkap: u.namaLengkap,
        role: u.role,
        allowedTopikIds: nextTopikIds,
        unitId: u.unitId,
        detail: u.detail,
        aktif: u.aktif,
        createdAt: u.createdAt,
      },
    });
    if (!res.ok) {
      toast.error(res.error ?? "Gagal menyimpan hak akses topik");
      return;
    }
    toast.success("Hak akses topik diperbarui");
    await router.invalidate();
  }

  return (
    <AdminPage>
      <div>
        <Link to="/admin/users" className="text-sm text-slate-500 hover:underline">
          ← Pengguna
        </Link>
      </div>
      <AdminPageHeader
        title="Hak Akses Role"
        description="Atur menu yang bisa diakses Admin Jurusan dan Evaluator, serta topik mana yang boleh mereka kelola."
      />

      <Card>
        <CardContent className="space-y-3 p-6">
          <h3 className="font-medium">Menu yang bisa diakses Admin Jurusan</h3>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {NAV_KEYS.filter((k) => k !== "users" && k !== "pengaturan" && k !== "tools").map(
              (k) => (
                <label key={k} className="flex items-center gap-2 rounded border p-2 text-sm">
                  <Checkbox
                    checked={adminProdiAccess.includes(k)}
                    onCheckedChange={() => toggleNav("admin_prodi", k)}
                  />
                  {LABEL[k]}
                </label>
              ),
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-6">
          <h3 className="font-medium">Menu yang bisa diakses Evaluator</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {NAV_KEYS.filter((k) => k !== "users" && k !== "pengaturan" && k !== "tools").map(
              (k) => (
                <label key={k} className="flex items-center gap-2 rounded border p-2 text-sm">
                  <Checkbox
                    checked={evaluatorAccess.includes(k)}
                    onCheckedChange={() => toggleNav("evaluator", k)}
                  />
                  {LABEL[k]}
                </label>
              ),
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h3 className="font-medium">Topik yang boleh dikelola Admin Jurusan & Evaluator</h3>
          {managers.length === 0 && (
            <p className="text-sm text-slate-500">Belum ada Admin Jurusan atau Evaluator.</p>
          )}
          {managers.map((u) => (
            <div key={u.id} className="rounded border p-3">
              <div className="mb-2 font-medium flex items-center justify-between">
                <div>
                  {u.namaLengkap}{" "}
                  <span className="text-xs text-slate-500">
                    ({u.role === "admin_prodi" ? "Admin Jurusan" : "Evaluator"})
                  </span>
                </div>
              </div>
              <div className="space-y-3">
                {moduls.map((m) => {
                  const ts = topiks.filter((t) => t.modulId === m.id);
                  if (ts.length === 0) return null;
                  const allSelected = ts.every((t) => u.allowedTopikIds.includes(t.id));
                  return (
                    <div key={m.id} className="border-t border-slate-100 dark:border-slate-800/80 pt-2 first:border-t-0 first:pt-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{m.nama}</span>
                        <div className="flex items-center gap-2 text-[11px]">
                          <button
                            type="button"
                            onClick={() => setBulkTopik(u, ts.map((t) => t.id), !allSelected)}
                            className="text-primary hover:underline font-medium"
                          >
                            {allSelected ? "Kosongkan Modul Ini" : "Pilih Semua Topik Modul Ini"}
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {ts.map((t) => (
                          <label
                            key={t.id}
                            className="flex items-center gap-1.5 rounded border px-2 py-1 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            <Checkbox
                              checked={u.allowedTopikIds.includes(t.id)}
                              onCheckedChange={() => toggleTopik(u, t.id)}
                            />
                            {t.nama}
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              {u.allowedTopikIds.length === 0 && (
                <p className="mt-2 text-xs text-slate-500">
                  (Kosong = boleh akses semua topik)
                </p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Button asChild variant="outline" size="sm" className="h-9">
        <Link to="/admin/users">← Selesai</Link>
      </Button>
    </AdminPage>
  );
}
