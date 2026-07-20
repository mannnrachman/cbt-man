import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { usersRepo, unitAkademikRepo, configRepo } from "@/lib/cbt/repos";
import { Card } from "@/components/ui/card";
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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cetak Kartu Peserta</h1>
          <p className="text-sm text-muted-foreground">Catatan: password hanya bisa dicetak jika diketahui (default: <code>username + "123"</code>). Untuk akun lama, reset dulu password-nya.</p>
        </div>
        <div className="flex gap-2">
          <Select value={unitId} onValueChange={setUnitId}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua unit</SelectItem>
              {units.map((u) => <SelectItem key={u.id} value={u.id}>{u.nama}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" />Cetak</Button>
        </div>
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
                <div><span className="text-muted-foreground">Nama:</span> <strong>{p.namaLengkap}</strong></div>
                <div><span className="text-muted-foreground">Username:</span> <code>{p.username}</code></div>
                <div><span className="text-muted-foreground">Password awal:</span> <code>{p.username}123</code></div>
                <div><span className="text-muted-foreground">Unit:</span> {u?.nama ?? "-"}</div>
              </div>
            </Card>
          );
        })}
        {peserta.length === 0 && <div className="col-span-full text-center text-muted-foreground">Tidak ada peserta.</div>}
      </div>
    </div>
  );
}
