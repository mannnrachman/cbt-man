import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { sesiRepo, usersRepo, unitAkademikRepo, mataKuliahRepo, semesterRepo } from "@/lib/cbt/repos";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, BookOpen, CalendarDays, BadgeCheck } from "lucide-react";
import { exportSheet } from "@/lib/cbt/excel";
import { useAuthStore } from "@/lib/cbt/auth-store";
import { visibleUjians } from "@/lib/cbt/access";

export const Route = createFileRoute("/_authenticated/admin/analitik/rekap")({
  component: RekapPage,
});

function RekapPage() {
  const user = useAuthStore((s) => s.user);
  const ujians = visibleUjians(user);
  const visibleUjianIds = new Set(ujians.map((u) => u.id));
  const units = unitAkademikRepo.all();
  const users = usersRepo.all();
  const [ujianId, setUjianId] = useState<string>("all");
  const [unitId, setUnitId] = useState<string>("all");

  const [dari, setDari] = useState("");
  const [sampai, setSampai] = useState("");

  const sesi = sesiRepo.all().filter((s) => {
    if (s.status !== "selesai") return false;
    if (!visibleUjianIds.has(s.ujianId)) return false;
    if (ujianId !== "all" && s.ujianId !== ujianId) return false;
    const u = users.find((x) => x.id === s.pesertaId);
    if (unitId !== "all" && u?.unitId !== unitId) return false;

    if (dari && (s.selesaiAt ?? 0) < new Date(dari).getTime()) return false;
    if (sampai && (s.selesaiAt ?? 0) > new Date(sampai).getTime() + 86_400_000) return false;
    return true;
  });

  const rows = sesi.map((s) => {
    const u = users.find((x) => x.id === s.pesertaId);
    const ex = ujians.find((x) => x.id === s.ujianId);
    const mk = ex?.mataKuliahId ? mataKuliahRepo.byId(ex.mataKuliahId) : null;
    const smt = ex?.semesterId ? semesterRepo.byId(ex.semesterId) : null;
    const g = units.find((x) => x.id === u?.unitId);
    const durasi = s.mulaiAt && s.selesaiAt ? Math.round((s.selesaiAt - s.mulaiAt) / 1000) : 0;

    function formatDateExcel(ms: number | undefined | null) {
      if (!ms) return "-";
      const d = new Date(ms);
      const pad = (n: number) => n.toString().padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }

    return {
      nama: u?.namaLengkap ?? "-",
      username: u?.username ?? "-",
      unit: g?.nama ?? "-",

      ujian: ex?.nama ?? "-",
      mataKuliah: mk?.nama ?? "-",
      semester: smt?.nama ?? "-",
      skor: s.skorTotal ?? 0,
      maks: s.maxSkor ?? 0,
      persen: s.maxSkor ? Math.round(((s.skorTotal ?? 0) / s.maxSkor) * 1000) / 10 : 0,
      durasi,
      tanggal: s.selesaiAt ? new Date(s.selesaiAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) : "-",
      mulaiAtStr: formatDateExcel(s.mulaiAt),
    };
  });

  function exportExcel() {
    const aoa: (string | number)[][] = [
      ["No", "Waktu Mulai", "Nama Tes", "Username", "Nama", "Group", "Poin"],
      ...rows.map((r, i) => [i + 1, r.mulaiAtStr, r.ujian, r.username, r.nama, r.unit, r.skor]),
    ];
    exportSheet(`rekap-hasil-${Date.now()}.xlsx`, [{ name: "Rekap", aoa }]);
  }

  return (
    <div className="space-y-6 pb-12 neo-ready">
      <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 rounded-xl border shadow-sm">
        <Link to="/admin/analitik" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 w-fit mb-3">
          ← Kembali ke daftar analitik
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Rekap Hasil Ujian</h1>
        <p className="text-sm text-muted-foreground mt-1">Saring dan ekspor hasil ujian peserta ke dalam format Microsoft Excel.</p>
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 gap-3 p-4 lg:grid-cols-5">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Ujian</label>
            <Select value={ujianId} onValueChange={setUjianId}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua ujian</SelectItem>
                {ujians.map((u) => {
                  const mk = u.mataKuliahId ? mataKuliahRepo.byId(u.mataKuliahId) : null;
                  return (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nama} {mk ? `(${mk.nama})` : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Unit Akademik</label>
            <Select value={unitId} onValueChange={setUnitId}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua unit</SelectItem>
                {units.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.nama}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Dari tanggal</label>
            <Input type="date" value={dari} onChange={(e) => setDari(e.target.value)} className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Sampai tanggal</label>
            <Input type="date" value={sampai} onChange={(e) => setSampai(e.target.value)} className="mt-1" />
          </div>
          <div className="flex items-end">
            <Button onClick={exportExcel} disabled={rows.length === 0} className="w-full">
              <Download className="mr-1.5 h-4 w-4" />
              Export Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border ring-1 ring-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="py-3.5 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Nama Peserta</TableHead>
              <TableHead className="py-3.5 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Unit Akademik</TableHead>
              <TableHead className="py-3.5 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Ujian (Mata Kuliah)</TableHead>
              <TableHead className="py-3.5 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Skor Akhir</TableHead>
              <TableHead className="py-3.5 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Persentase</TableHead>
              <TableHead className="py-3.5 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Waktu Penyelesaian</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i} className="hover:bg-muted/30 transition-colors">
                <TableCell className="p-4">
                  <div className="font-semibold text-foreground">{r.nama}</div>
                  <div className="text-xs text-muted-foreground font-mono mt-0.5">{r.username}</div>
                </TableCell>
                <TableCell className="p-4">
                  <Badge variant="outline" className="font-medium">
                    {r.unit}
                  </Badge>
                </TableCell>
                <TableCell className="p-4">
                  <div className="font-medium text-foreground">{r.ujian}</div>
                  {r.mataKuliah !== "-" && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <BookOpen className="h-3.5 w-3.5" />
                      {r.mataKuliah}
                    </div>
                  )}
                </TableCell>
                <TableCell className="p-4 font-bold text-base">
                  {r.skor} <span className="text-xs font-normal text-muted-foreground">/ {r.maks}</span>
                </TableCell>
                <TableCell className="p-4">
                  <Badge
                    variant={r.persen >= 75 ? "default" : r.persen >= 50 ? "secondary" : "destructive"}
                    className="gap-1 font-bold"
                  >
                    <BadgeCheck className="h-3.5 w-3.5" /> {r.persen}%
                  </Badge>
                </TableCell>
                <TableCell className="p-4">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {r.tanggal}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="p-12 text-center text-muted-foreground bg-muted/10">
                  Tidak ada data sesi ujian yang sesuai dengan filter.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

