import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { usersRepo, unitAkademikRepo, configRepo } from "@/lib/cbt/repos";
import { Card } from "@/components/ui/card";
import { AdminPage, AdminPageHeader } from "@/components/cbt/AdminPage";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/peserta/kartu")({
  component: KartuPage,
});

function KartuPage() {
  const [unitId, setUnitId] = useState<string>("all");
  const units = unitAkademikRepo.all();
  const peserta = usersRepo.all().filter((u) => u.role === "mahasiswa" && (unitId === "all" || u.unitId === unitId));
  const appName = configRepo.get().appName;

  return (
    <AdminPage>
      <div className="flex items-center justify-between gap-2 print:hidden">
        <AdminPageHeader
          title="Cetak Kartu Peserta"
          description='Catatan: password hanya bisa dicetak jika diketahui (default: username + "123"). Untuk akun lama, reset dulu password-nya.'
          action={
            <div className="flex gap-2">
              <Select value={unitId} onValueChange={setUnitId}>
                <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua unit</SelectItem>
                  {units.map((u) => <SelectItem key={u.id} value={u.id}>{u.nama}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={() => window.print()} size="sm" className="h-9"><Printer className="mr-1 h-4 w-4" />Cetak</Button>
            </div>
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-3 print:grid-cols-2 md:grid-cols-3">
        {peserta.map((p) => {
          const u = units.find((x) => x.id === p.unitId);
          return (
            <Card key={p.id} className="p-4 break-inside-avoid">
              <div className="mb-2 flex items-center gap-2 border-b pb-2 text-sm font-semibold">
                <span className="grid h-7 w-7 place-items-center rounded bg-primary text-primary-foreground">Z</span>
                {appName} — Kartu Ujian
              </div>
              <div className="space-y-1 text-sm">
                <div><span className="text-slate-500">Nama:</span> <strong>{p.namaLengkap}</strong></div>
                <div><span className="text-slate-500">Username:</span> <code>{p.username}</code></div>
                <div><span className="text-slate-500">Password awal:</span> <code>{p.username}123</code></div>
                <div><span className="text-slate-500">Unit:</span> {u?.nama ?? "-"}</div>
              </div>
            </Card>
          );
        })}
        {peserta.length === 0 && <div className="col-span-full text-center text-slate-500">Tidak ada peserta.</div>}
      </div>
    </AdminPage>
  );
}
