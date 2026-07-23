import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ujianRepo, usersRepo, unitAkademikRepo } from "@/lib/cbt/repos";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/ujian/$id/peserta")({
  component: PesertaUjian,
});

function PesertaUjian() {
  const { id } = useParams({ from: "/_authenticated/admin/ujian/$id/peserta" });
  const ujian = ujianRepo.byId(id);
  const [selectedUnit, setSelectedUnit] = useState("all");

  if (!ujian) return <div>Tidak ditemukan</div>;
  const users = usersRepo.all();
  const units = unitAkademikRepo.all();
  const unitYangIkut = ujian.groupIds.includes("all")
    ? units
    : units.filter((u) => ujian.groupIds.includes(u.id));

  const peserta = users.filter(
    (u) =>
      u.role === "mahasiswa" &&
      (ujian.groupIds.includes("all") ||
        ujian.groupIds.length === 0 ||
        ujian.groupIds.includes(u.unitId ?? "")) &&
      (selectedUnit === "all" || u.unitId === selectedUnit),
  );


  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <Link to="/admin/ujian" className="text-sm text-muted-foreground hover:underline">
            ← Paket ujian
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">
            Peserta: {ujian.nama}
          </h1>
          <p className="text-sm text-muted-foreground">
            {peserta.length} peserta dari {unitYangIkut.length} unit
            {ujian.groupIds.length === 0 && " (semua unit)"}
          </p>
        </div>
        <Link to="/admin/peserta/kartu">
          <Button variant="outline">
            <Printer className="mr-1 h-4 w-4" />
            Cetak Kartu
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="mb-3 text-sm font-medium">Unit yang berhak ikut:</div>
          <Select value={selectedUnit} onValueChange={setSelectedUnit}>
            <SelectTrigger className="w-[280px] mb-4">
              <SelectValue placeholder="Filter Unit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Unit</SelectItem>
              {unitYangIkut.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.nama}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex flex-wrap gap-2">
            {unitYangIkut.map((u) => (
              <span key={u.id} className="rounded bg-accent px-3 py-1 text-sm">
                {u.nama}
              </span>
            ))}
            {ujian.groupIds.length === 0 && (
              <span className="text-sm text-muted-foreground">Semua unit / publik</span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left">
              <tr>
                <th className="p-3">#</th>
                <th className="p-3">Username</th>
                <th className="p-3">Nama</th>
                <th className="p-3">Unit</th>
                <th className="p-3">Status akun</th>
              </tr>
            </thead>
            <tbody>
              {peserta.map((p, i) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="p-3 text-muted-foreground">{i + 1}</td>
                  <td className="p-3 font-mono text-xs">{p.username}</td>
                  <td className="p-3">{p.namaLengkap}</td>
                  <td className="p-3">{units.find((u) => u.id === p.unitId)?.nama ?? "-"}</td>
                  <td className="p-3">{p.aktif ? "Aktif" : "Nonaktif"}</td>
                </tr>
              ))}
              {peserta.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-muted-foreground">
                    Tidak ada peserta untuk ujian ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
