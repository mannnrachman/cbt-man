import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { sesiRepo, ujianRepo, soalRepo, mataKuliahRepo, semesterRepo, usersRepo } from "@/lib/cbt/repos";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, BookOpen, Target, PercentSquare, AlertCircle } from "lucide-react";
import { analisisButir, labelKesukaran, labelDiskriminasi } from "@/lib/cbt/analisis";
import { exportSheet, stripHtml } from "@/lib/cbt/excel";
import { RichView } from "@/components/cbt/RichEditor";

export const Route = createFileRoute("/_authenticated/admin/analitik/analisis")({
  component: AnalisisPage,
});

function AnalisisPage() {
  const ujians = ujianRepo.all();
  const [ujianId, setUjianId] = useState(ujians[0]?.id ?? "");

  const sesis = sesiRepo
    .all()
    .filter((s) => s.ujianId === ujianId && s.status === "selesai");
  const soals = soalRepo.all();
  const stats = analisisButir(sesis, soals);

  function exportExcel() {
    const selectedUjian = ujians.find((u) => u.id === ujianId);
    const mk = selectedUjian?.mataKuliahId ? mataKuliahRepo.byId(selectedUjian.mataKuliahId) : null;
    const smt = selectedUjian?.semesterId ? semesterRepo.byId(selectedUjian.semesterId) : null;

    const aoaStatistik: (string | number)[][] = [
      ["Laporan Analisis Butir Soal"],
      ["Ujian", selectedUjian?.nama ?? "-"],
      ["Mata Kuliah", mk?.nama ?? "-"],
      ["Semester", smt?.nama ?? "-"],
      [],
      [
        "No",
        "Soal",
        "Tipe",
        "Mengerjakan",
        "Benar",
        "Tingkat Kesukaran",
        "Label TK",
        "Indeks Diskriminasi",
        "Label DK",
      ],
      ...stats.map((s, i) => {
        const soal = soals.find((x) => x.id === s.soalId);
        return [
          i + 1,
          stripHtml(soal?.detail ?? "-").slice(0, 200),
          soal?.tipe ?? "-",
          s.jumlahMengerjakan,
          s.jumlahBenar,
          Math.round(s.tingkatKesukaran * 1000) / 10 + "%",
          labelKesukaran(s.tingkatKesukaran),
          Math.round(s.indeksDiskriminasi * 100) / 100,
          labelDiskriminasi(s.indeksDiskriminasi),
        ];
      }),
    ];

    const header1 = ["", "", "", "Nomor Soal"];
    const header2 = ["No", "Username", "Nama", ...stats.map((_, i) => i + 1)];
    const dataRows = sesis.map((s, i) => {
      const u = usersRepo.byId(s.pesertaId);
      const grid = stats.map(st => {
         const j = s.jawaban.find(x => x.soalId === st.soalId);
         if (!j) return 0;
         return (j.skor && j.skor > 0) ? 1 : 0;
      });
      return [i + 1, u?.username ?? "-", u?.namaLengkap ?? "-", ...grid];
    });

    const aoaGrid: (string | number)[][] = [
      ["ANALISIS BUTIR SOAL"],
      ["Grup Peserta", "Semua Grup"],
      ["Nama Tes", selectedUjian?.nama ?? "-"],
      [],
      header1,
      header2,
      ...dataRows
    ];

    exportSheet(`analisis-butir-${Date.now()}.xlsx`, [
      { name: "Grid Jawaban", aoa: aoaGrid },
      { name: "Statistik Item", aoa: aoaStatistik }
    ]);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 rounded-xl border shadow-sm">
        <Link to="/admin/analitik" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 w-fit mb-3">
          ← Kembali ke daftar analitik
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Analisis Butir Soal</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Analisis komprehensif tingkat kesukaran, indeks diskriminasi (metode upper-lower 27%), dan efektivitas daya pengecoh opsi.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-[260px]">
            <label className="text-xs">Paket ujian</label>
            <Select value={ujianId} onValueChange={setUjianId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
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
          <Button onClick={exportExcel} disabled={stats.length === 0}>
            <Download className="mr-1 h-4 w-4" />
            Export Excel
          </Button>
          <span className="text-xs text-muted-foreground">
            {sesis.length} sesi selesai · {stats.length} soal dianalisis
          </span>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {stats.map((s, i) => {
          const soal = soals.find((x) => x.id === s.soalId);
          return (
            <Card key={s.soalId} className="shadow-sm border ring-1 ring-border/30 overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b bg-muted/20 p-4">
                <div className="flex items-center gap-2">
                  <span className="bg-primary/10 text-primary font-bold px-2.5 py-1 rounded-md text-sm border border-primary/20">#{i + 1}</span>
                  <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground bg-muted px-2 py-1 rounded">{soal?.tipe}</span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5 bg-background border px-2.5 py-1.5 rounded-lg shadow-sm">
                    <Target className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">TK:</span>
                    <strong className="text-foreground">{Math.round(s.tingkatKesukaran * 1000) / 10}%</strong>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                      s.tingkatKesukaran > 0.7 ? 'bg-success/15 text-success' :
                      s.tingkatKesukaran < 0.3 ? 'bg-destructive/15 text-destructive' :
                      'bg-warning/15 text-warning-foreground'
                    }`}>
                      {labelKesukaran(s.tingkatKesukaran)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-background border px-2.5 py-1.5 rounded-lg shadow-sm">
                    <PercentSquare className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">DK:</span>
                    <strong className="text-foreground">{Math.round(s.indeksDiskriminasi * 100) / 100}</strong>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                      s.indeksDiskriminasi >= 0.4 ? 'bg-success/15 text-success' :
                      s.indeksDiskriminasi <= 0.19 ? 'bg-destructive/15 text-destructive' :
                      'bg-warning/15 text-warning-foreground'
                    }`}>
                      {labelDiskriminasi(s.indeksDiskriminasi)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-background border px-2.5 py-1.5 rounded-lg shadow-sm">
                    <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    <strong>{s.jumlahBenar}</strong> <span className="text-muted-foreground">/ {s.jumlahMengerjakan} benar</span>
                  </div>
                </div>
              </div>
              <CardContent className="p-4 space-y-4">
                {soal && (
                  <div className="mb-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 block">
                      Pertanyaan Soal
                    </span>
                    <div className="prose prose-slate dark:prose-invert max-w-none text-slate-800 dark:text-slate-200 text-base md:text-[15px] font-medium leading-relaxed">
                      <RichView html={soal.detail} />
                    </div>
                  </div>
                )}
                
                {soal && soal.tipe !== "essay" && (
                  <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 mt-2">
                    {soal.jawaban.map((o, idx) => (
                      <div
                        key={o.id}
                        className={`rounded-lg border p-2 flex items-center justify-between ${
                          o.benar ? "bg-success/5 border-success/30 shadow-sm" : "bg-muted/10"
                        }`}
                      >
                        <div>
                          <span className="font-mono bg-background border px-1.5 py-0.5 rounded shadow-sm mr-1.5">
                            {String.fromCharCode(65 + idx)}
                          </span>
                          <span className="text-muted-foreground">dipilih:</span> <strong className="text-foreground">{s.dayaPengecoh[o.id] ?? 0}</strong>
                        </div>
                        {o.benar && <span className="text-success font-bold">Kunci</span>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {stats.length === 0 && (
          <div className="rounded border-2 border-dashed p-8 text-center text-muted-foreground">
            Belum ada sesi selesai untuk dianalisis.
          </div>
        )}
      </div>
    </div>
  );
}
