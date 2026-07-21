import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ujianRepo, usersRepo, groupsRepo } from "@/lib/cbt/repos";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/ujian/$id/peserta")({
  component: PesertaUjian,
});

function PesertaUjian() {
  const { id } = useParams({ from: "/_authenticated/admin/ujian/$id/peserta" });
  const ujian = ujianRepo.byId(id);
  if (!ujian) return <div>Tidak ditemukan</div>;
  const groups = groupsRepo.all();
  const groupYangIkut = ujian.groupIds.length
    ? groups.filter((g) => ujian.groupIds.includes(g.id))
    : groups;
  const peserta = usersRepo
    .all()
    .filter(
      (u) =>
        u.role === "mahasiswa" &&
        (ujian.groupIds.length === 0 || ujian.groupIds.includes(u.groupId ?? "")),
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
            {peserta.length} peserta dari {groupYangIkut.length} group
            {ujian.groupIds.length === 0 && " (semua group)"}
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
          <div className="mb-3 text-sm font-medium">Group yang berhak ikut:</div>
          <div className="flex flex-wrap gap-2">
            {groupYangIkut.map((g) => (
              <span key={g.id} className="rounded bg-accent px-3 py-1 text-sm">
                {g.nama}
              </span>
            ))}
            {ujian.groupIds.length === 0 && (
              <span className="text-sm text-muted-foreground">Semua group / publik</span>
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
                <th className="p-3">Group</th>
                <th className="p-3">Status akun</th>
              </tr>
            </thead>
            <tbody>
              {peserta.map((p, i) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="p-3 text-muted-foreground">{i + 1}</td>
                  <td className="p-3 font-mono text-xs">{p.username}</td>
                  <td className="p-3">{p.namaLengkap}</td>
                  <td className="p-3">{groups.find((g) => g.id === p.groupId)?.nama ?? "-"}</td>
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
