import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ujianRepo, sesiRepo, usersRepo } from "@/lib/cbt/repos";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/leaderboard/$id")({
  component: Leaderboard,
});

function Leaderboard() {
  const { id } = useParams({ from: "/_authenticated/admin/leaderboard/$id" });
  const ujian = ujianRepo.byId(id);
  if (!ujian) return <div>Tidak ditemukan</div>;
  const sesis = sesiRepo.all()
    .filter((s) => s.ujianId === id && s.status === "selesai")
    .sort((a, b) => {
      const da = (b.skorTotal ?? 0) - (a.skorTotal ?? 0);
      if (da !== 0) return da;
      return (a.selesaiAt ?? 0) - (a.mulaiAt ?? 0) - ((b.selesaiAt ?? 0) - (b.mulaiAt ?? 0));
    });
  const users = usersRepo.all();

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <Link to="/admin/ujian" className="text-sm text-muted-foreground hover:underline">← Paket ujian</Link>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2"><Trophy className="h-6 w-6 text-warning" />Leaderboard — {ujian.nama}</h1>
      </div>
      <Card><CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left"><tr><th className="p-3 w-12">#</th><th className="p-3">Peserta</th><th className="p-3">Skor</th><th className="p-3">Waktu</th></tr></thead>
          <tbody>
            {sesis.map((s, i) => {
              const u = users.find((x) => x.id === s.pesertaId);
              const dur = s.selesaiAt && s.mulaiAt ? Math.round((s.selesaiAt - s.mulaiAt) / 1000) : 0;
              const mm = Math.floor(dur / 60), ss = dur % 60;
              return (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="p-3 font-bold">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</td>
                  <td className="p-3">{u?.namaLengkap}</td>
                  <td className="p-3 font-medium">{s.skorTotal} / {s.maxSkor}</td>
                  <td className="p-3 text-xs">{mm}m {ss}s</td>
                </tr>
              );
            })}
            {sesis.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Belum ada peserta selesai.</td></tr>}
          </tbody>
        </table>
      </CardContent></Card>
    </div>
  );
}
