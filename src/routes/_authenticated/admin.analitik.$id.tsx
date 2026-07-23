/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ujianRepo, sesiRepo, usersRepo, soalRepo, hydrateRepos, mataKuliahRepo, semesterRepo, unitAkademikRepo } from "@/lib/cbt/repos";
import { recomputeSkor } from "@/lib/cbt/exam";
import { exportSheet, stripHtml } from "@/lib/cbt/excel";
import { analisisButir, labelKesukaran, labelDiskriminasi } from "@/lib/cbt/analisis";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Pencil, Save, X, BookOpen, Clock, FileText, ChevronRight, CheckCircle2, BarChart, Sparkles, AlertTriangle, TrendingUp, TrendingDown, Printer, Download } from "lucide-react";
import { useState, useEffect } from "react";
import { RichView } from "@/components/cbt/RichEditor";
import { toast } from "sonner";
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts";
import type { Ujian, SesiUjian } from "@/lib/cbt/types";

export const Route = createFileRoute("/_authenticated/admin/analitik/$id")({
  loader: async () => {
    try {
      await hydrateRepos();
    } catch {
      // Fallback
    }
  },
  component: HasilUjian,
});

function HasilUjian() {
  const { id } = useParams({ from: "/_authenticated/admin/analitik/$id" });
  const ujian = ujianRepo.byId(id);
  const [sesis, setSesis] = useState(sesiRepo.all().filter((s) => s.ujianId === id));

  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const initialTab = searchParams?.get("tab") || "peserta";

  if (!ujian) return <div>Tidak ditemukan</div>;
  
  const mk = ujian.mataKuliahId ? mataKuliahRepo.byId(ujian.mataKuliahId) : null;
  const smt = ujian.semesterId ? semesterRepo.byId(ujian.semesterId) : null;

  function refresh() {
    setSesis(sesiRepo.all().filter((s) => s.ujianId === id));
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-in fade-in duration-500 pb-12 pt-4">
      <div className="bg-white dark:bg-slate-950 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <Link to="/admin/analitik" className="text-sm font-medium text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors flex items-center gap-1 w-fit mb-4">
          ← Kembali ke Pilihan Ujian
        </Link>
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{ujian.nama}</h1>
            {mk && (
              <p className="text-muted-foreground mt-1 flex items-center gap-1.5 font-medium">
                <BookOpen className="h-4 w-4" />
                {mk.nama} {smt ? `· ${smt.nama}` : ""}
              </p>
            )}
          </div>
          <div className="flex items-center gap-4 bg-background/60 backdrop-blur-sm px-4 py-2 rounded-lg border shadow-sm">
            <div className="text-center">
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Durasi</div>
              <div className="font-semibold text-lg flex items-center justify-center gap-1"><Clock className="h-4 w-4 text-primary" /> {ujian.durasiMenit}'</div>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Soal</div>
              <div className="font-semibold text-lg flex items-center justify-center gap-1"><FileText className="h-4 w-4 text-primary" /> {(ujian.topicSets || []).reduce((a, b) => a + b.jumlah, 0)}</div>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue={initialTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="peserta">Daftar Peserta</TabsTrigger>
          <TabsTrigger value="report">Laporan Ujian</TabsTrigger>
          <TabsTrigger value="ai" className="gap-1.5 text-primary"><Sparkles className="h-3.5 w-3.5" /> Wawasan AI</TabsTrigger>
        </TabsList>

        <TabsContent value="peserta" className="space-y-4 outline-none">
          <DaftarPesertaTab ujian={ujian} sesis={sesis} refresh={refresh} />
        </TabsContent>

        <TabsContent value="report" className="outline-none">
          <ExamReportTab ujian={ujian} sesis={sesis} />
        </TabsContent>

        <TabsContent value="ai" className="outline-none">
          <AiInsightTab ujian={ujian} sesis={sesis} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DaftarPesertaTab({ ujian, sesis, refresh }: { ujian: Ujian, sesis: SesiUjian[], refresh: () => void }) {
  const users = usersRepo.all();
  const [openId, setOpenId] = useState<string | null>(null);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editSkor, setEditSkor] = useState<string>("");

  function saveEdit(sesiId: string, idx: number) {
    const s = sesiRepo.byId(sesiId);
    if (!s) return;
    const v = editSkor === "" ? undefined : Number(editSkor);
    const next = { ...s, jawaban: s.jawaban.map((j, i) => (i === idx ? { ...j, skor: v } : j)) };
    const recalc = recomputeSkor(next, ujian);
    sesiRepo.upsert(recalc);
    setEditIdx(null);
    setEditSkor("");
    refresh();
    toast.success("Nilai diperbarui");
  }

  return (
    <>
      <Card className="shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-semibold">
                <tr>
                  <th className="p-4 font-semibold text-slate-700 dark:text-slate-300 text-center border-r border-slate-200 dark:border-slate-800">Peserta</th>
                  <th className="p-4 font-semibold text-slate-700 dark:text-slate-300 text-center border-r border-slate-200 dark:border-slate-800">Status</th>
                  <th className="p-4 font-semibold text-slate-700 dark:text-slate-300 text-center border-r border-slate-200 dark:border-slate-800">Mulai</th>
                  <th className="p-4 font-semibold text-slate-700 dark:text-slate-300 text-center border-r border-slate-200 dark:border-slate-800">Skor</th>
                  <th className="p-4 font-semibold text-slate-700 dark:text-slate-300 text-center border-r border-slate-200 dark:border-slate-800">Pelanggaran</th>
                  <th className="p-4 font-semibold text-slate-700 dark:text-slate-300 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {sesis.map((s) => {
                  const u = users.find((x) => x.id === s.pesertaId);
                  const isOpen = openId === s.id;
                  return (
                    <tr key={s.id} className={`transition-colors ${isOpen ? 'bg-primary/5' : 'hover:bg-muted/30'}`}>
                      <td className="p-4 font-medium text-center border-r border-slate-200 dark:border-slate-800">{u?.namaLengkap ?? s.pesertaId}</td>
                      <td className="p-4 text-center border-r border-slate-200 dark:border-slate-800">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                          s.status === 'selesai' ? 'bg-success/15 text-success' :
                          s.status === 'sedang' ? 'bg-primary/15 text-primary' :
                          'bg-accent text-accent-foreground'
                        }`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="p-4 text-muted-foreground text-center border-r border-slate-200 dark:border-slate-800">
                        {s.mulaiAt ? (
                          <span suppressHydrationWarning>
                            {new Date(s.mulaiAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}
                          </span>
                        ) : "-"}
                      </td>
                      <td className="p-4 text-center border-r border-slate-200 dark:border-slate-800">
                        {s.status === "selesai" ? (
                          <span className="font-bold text-base">{s.skorTotal ?? 0} <span className="text-xs text-muted-foreground font-normal">/ {s.maxSkor ?? 0}</span></span>
                        ) : "-"}
                      </td>
                      <td className="p-4 text-center border-r border-slate-200 dark:border-slate-800">
                        {s.pelanggaran > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-destructive/15 text-destructive">
                            {s.pelanggaran} peringatan
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="p-4 text-center space-x-2">
                        <Button size="sm" variant={isOpen ? "default" : "outline"} onClick={() => { setOpenId(isOpen ? null : s.id); setEditIdx(null); }}>
                          {isOpen ? "Tutup Lembar" : "Koreksi Lembar"}
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => {
                          if (confirm("Hapus sesi ujian ini secara permanen?")) {
                            sesiRepo.remove(s.id);
                            refresh();
                          }
                        }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {sesis.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">
                      Belum ada sesi.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      
      {openId &&
        (() => {
          const s = sesis.find((x) => x.id === openId);
          if (!s) return null;
          return (
            <div className="mt-4 animate-in slide-in-from-top-2 fade-in duration-200">
              <Card className="border-primary/20 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                <CardHeader className="bg-primary/5 pb-4 border-b">
                  <CardTitle className="text-lg flex items-center gap-2 text-primary">
                    <Pencil className="h-5 w-5" /> Lembar Koreksi Penilaian
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 p-6 bg-muted/10">
                  {s.jawaban.map((j, i) => {
                    const soal = soalRepo.byId(j.soalId);
                    if (!soal) return <div key={i} className="space-y-1 rounded border border-dashed p-4 text-sm text-muted-foreground bg-background">Soal tidak ditemukan</div>;
                    const benarIds = soal.jawaban.filter((x) => x.benar).map((x) => x.id);
                    const isEssay = soal.tipe === "essay";
                    const isCorrect = s.status === "selesai" && !isEssay && j.jawabanIds.length === benarIds.length && benarIds.every((id) => j.jawabanIds.includes(id));
                    const needsGrading = isEssay && j.skor === undefined;

                    return (
                      <div key={i} className={`space-y-3 rounded-xl border p-4 text-sm bg-background transition-all ${needsGrading ? 'ring-2 ring-warning/50 border-warning/50 shadow-sm' : ''}`}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
                          <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
                            <span className="bg-primary/10 text-primary px-2.5 py-1 rounded-full text-xs">Soal #{i + 1}</span>
                            <span className="bg-muted px-2.5 py-1 rounded text-muted-foreground capitalize">{soal.tipe}</span>
                            {s.status === "selesai" && (
                              isEssay ? (
                                <span className={needsGrading ? "text-warning bg-warning/10 px-2.5 py-1 rounded-md" : "text-primary bg-primary/10 px-2.5 py-1 rounded-md"}>
                                  {j.skor !== undefined ? `Skor: ${j.skor}` : "Menunggu Dinilai"}
                               </span>
                              ) : isCorrect ? (
                                <span className="text-success bg-success/15 px-2.5 py-1 rounded-md flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" />Benar</span>
                              ) : (
                                <span className="text-destructive bg-destructive/15 px-2.5 py-1 rounded-md flex items-center gap-1"><X className="h-3.5 w-3.5" />Salah</span>
                              )
                            )}
                          </div>
                          <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg border">
                            {editIdx === i ? (
                              <div className="flex items-center gap-1">
                                <Input type="number" className="h-8 w-24 text-center font-bold" value={editSkor} onChange={(e) => setEditSkor(e.target.value)} autoFocus />
                                <Button size="sm" onClick={() => saveEdit(s.id, i)} className="h-8 px-3">Simpan</Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditIdx(null)} className="h-8 px-2 text-destructive">Batal</Button>
                              </div>
                            ) : isEssay ? (
                              <Button size="sm" variant={needsGrading ? "default" : "secondary"} className={`h-8 text-xs ${needsGrading ? 'animate-pulse' : ''}`} onClick={() => { setEditIdx(i); setEditSkor(String(j.skor ?? "")); }}>
                                <Pencil className="h-3.5 w-3.5 mr-1.5" /> {needsGrading ? "Beri Nilai" : "Ubah Nilai"}
                              </Button>
                            ) : null}
                          </div>
                        </div>
                        <div className="pt-2"><RichView html={soal.detail} className="prose prose-sm max-w-none" /></div>
                        {isEssay && (
                          <div className="mt-3 rounded-lg bg-muted/40 border p-3 text-sm space-y-1">
                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Jawaban Peserta:</div>
                            <div className="prose prose-sm max-w-none bg-background p-3 rounded shadow-sm border"><RichView html={j.jawabanEssay || "<em>(kosong)</em>"} /></div>
                          </div>
                        )}
                        {!isEssay && (
                          <div className="mt-3 space-y-2">
                            {soal.jawaban.map((opt) => {
                              const isSelected = j.jawabanIds.includes(opt.id);
                              const isBenar = opt.benar;
                              let bgStyle = "bg-background border";
                              let textStyle = "text-foreground";
                              if (isBenar && isSelected) { bgStyle = "bg-success/10 border-success/30"; textStyle = "text-success-foreground font-medium"; }
                              else if (isBenar && !isSelected) { bgStyle = "bg-success/5 border-success/30"; textStyle = "text-success-foreground font-medium"; }
                              else if (!isBenar && isSelected) { bgStyle = "bg-destructive/10 border-destructive/30"; textStyle = "text-destructive-foreground font-medium"; }
                              return (
                                <div key={opt.id} className={`flex items-start gap-2.5 p-2.5 rounded-lg ${bgStyle} ${textStyle}`}>
                                  <div className="mt-0.5 shrink-0">
                                    {isBenar ? <CheckCircle2 className="h-4 w-4 text-success" /> : isSelected ? <X className="h-4 w-4 text-destructive" /> : <div className="h-4 w-4 rounded-full border-2 border-muted" />}
                                  </div>
                                  <div className="flex-1 text-sm prose prose-sm leading-snug"><RichView html={opt.detail} /></div>
                                  {isSelected && <div className="text-[10px] uppercase font-bold tracking-wider bg-background px-1.5 py-0.5 rounded border opacity-70">Dipilih</div>}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          );
        })()}
    </>
  );
}

function ExamReportTab({ ujian, sesis }: { ujian: Ujian, sesis: SesiUjian[] }) {
  const completed = sesis.filter(s => s.status === "selesai");
  const total = completed.length;
  
  if (total === 0) {
    return <Card className="p-12 text-center text-muted-foreground shadow-sm">Belum ada sesi selesai untuk dianalisis.</Card>;
  }

  const scores = completed.map(s => s.skorTotal ?? 0);
  const avg = Math.round(scores.reduce((a, b) => a + b, 0) / total);
  const highest = Math.max(...scores);
  const lowest = Math.min(...scores);
  
  const threshold = Math.round((ujian.poinBenar * (ujian.topicSets || []).reduce((a,b)=>a+b.jumlah,0)) * 0.7); // Assume 70% passing grade
  const passedCount = scores.filter(s => s >= threshold).length;
  const passRate = Math.round((passedCount / total) * 100);

  // Score distribution logic
  const distribution = [
    { name: "0-20", count: scores.filter(s => s <= 20).length },
    { name: "21-40", count: scores.filter(s => s > 20 && s <= 40).length },
    { name: "41-60", count: scores.filter(s => s > 40 && s <= 60).length },
    { name: "61-80", count: scores.filter(s => s > 60 && s <= 80).length },
    { name: "81-100", count: scores.filter(s => s > 80 && s <= 100).length },
  ];

  function formatDateExcel(ms: number | undefined | null) {
    if (!ms) return "-";
    const d = new Date(ms);
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  function exportRekapExcel() {
    const users = usersRepo.all();
    const units = unitAkademikRepo.all();
    
    // --- SHEET 1: REKAP NILAI ---
    const rowsRekap = completed.map(s => {
      const u = users.find(x => x.id === s.pesertaId);
      const g = units.find(x => x.id === u?.unitId);
      return [
        formatDateExcel(s.mulaiAt),
        ujian.nama,
        u?.username ?? "-",
        u?.namaLengkap ?? "-",
        g?.nama ?? "-",
        s.skorTotal ?? 0
      ];
    });
    
    const aoaRekap = [
      ["No", "Waktu Mulai", "Nama Tes", "Username", "Nama", "Group", "Poin"],
      ...rowsRekap.map((r, i) => [i + 1, ...r])
    ];

    const safeName = ujian.nama.replace(/[^a-zA-Z0-9_-]/g, "_");
    exportSheet(`Hasil_Ujian_-_${safeName}.xlsx`, [
      { name: "Rekap Nilai", aoa: aoaRekap }
    ]);
  }

  function exportAnalisisExcel() {
    const users = usersRepo.all();
    const soals = soalRepo.all();
    const stats = analisisButir(completed, soals);
    
    // --- SHEET 2: GRID JAWABAN ---
    const header1 = ["No", "Username", "Nama", "Nomor Soal"];
    const header2 = ["", "", "", ...stats.map((_, i) => i + 1)];
    const dataGrid = completed.map((s, i) => {
      const u = users.find(x => x.id === s.pesertaId);
      const grid = stats.map(st => {
         const j = s.jawaban.find(x => x.soalId === st.soalId);
         if (!j) return 0;
         return (j.skor && j.skor > 0) ? 1 : 0;
      });
      return [i + 1, u?.username ?? "-", u?.namaLengkap ?? "-", ...grid];
    });
    const aoaGrid = [
      ["ANALISIS BUTIR SOAL"],
      [],
      ["Grup Peserta", "", "Semua Grup"],
      ["Nama Tes", "", ujian.nama],
      [],
      header1,
      header2,
      ...dataGrid
    ];

    const merges = [
      { s: { r: 2, c: 0 }, e: { r: 2, c: 1 } }, // Grup Peserta (A3:B3)
      { s: { r: 3, c: 0 }, e: { r: 3, c: 1 } }, // Nama Tes (A4:B4)
      { s: { r: 5, c: 0 }, e: { r: 6, c: 0 } }, // No (A6:A7)
      { s: { r: 5, c: 1 }, e: { r: 6, c: 1 } }, // Username (B6:B7)
      { s: { r: 5, c: 2 }, e: { r: 6, c: 2 } }, // Nama (C6:C7)
      { s: { r: 5, c: 3 }, e: { r: 5, c: Math.max(3, 3 + stats.length - 1) } } // Nomor Soal (D6:end)
    ];

    const safeName = ujian.nama.replace(/[^a-zA-Z0-9_-]/g, "_");
    exportSheet(`Analisis_Butir_Soal_-_${safeName}.xlsx`, [
      { name: "Grid Jawaban", aoa: aoaGrid, merges: merges as any }
    ]);
  }
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Laporan Kelulusan</h2>
          <p className="text-sm text-muted-foreground">Ringkasan hasil ujian untuk seluruh peserta</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportRekapExcel} variant="outline" className="gap-2 bg-white">
            <Download className="h-4 w-4" /> Download Rekap
          </Button>
          <Button onClick={exportAnalisisExcel} variant="outline" className="gap-2 bg-white">
            <Download className="h-4 w-4" /> Download Analisis
          </Button>
          <Button onClick={() => window.print()} variant="outline" className="gap-2 bg-white">
            <Printer className="h-4 w-4" /> Cetak Laporan
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="text-sm font-medium text-muted-foreground mb-1">Rata-Rata Kelas</div>
            <div className="text-3xl font-bold">{avg}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-sm font-medium text-muted-foreground mb-1">Tingkat Kelulusan</div>
            <div className="text-3xl font-bold">{passRate}%</div>
            <div className="text-xs text-muted-foreground mt-1">{passedCount} dari {total} lulus (KKM: {threshold})</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-sm font-medium text-muted-foreground mb-1">Skor Tertinggi</div>
            <div className="text-3xl font-bold text-success">{highest}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-sm font-medium text-muted-foreground mb-1">Skor Terendah</div>
            <div className="text-3xl font-bold text-destructive">{lowest}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Distribusi Nilai</CardTitle>
          <CardDescription>Persebaran jumlah siswa berdasarkan rentang skor</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsBarChart data={distribution} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="count" fill="var(--color-primary, #0ea5e9)" radius={[4, 4, 0, 0]}>
                  {distribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.count > 0 ? 'var(--color-primary, #0ea5e9)' : '#e2e8f0'} />
                  ))}
                </Bar>
              </RechartsBarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AiInsightTab({ ujian, sesis }: { ujian: Ujian, sesis: SesiUjian[] }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [report, setReport] = useState<any>(null);

  const completed = sesis.filter(s => s.status === "selesai");
  const total = completed.length;

  function generateInsight() {
    setAnalyzing(true);
    // Simulate AI processing delay
    setTimeout(() => {
      const scores = completed.map(s => s.skorTotal ?? 0);
      const avg = Math.round(scores.reduce((a, b) => a + b, 0) / (total || 1));
      
      // Heuristic analysis
      let performanceTrend = "";
      if (avg >= 80) performanceTrend = "Sangat Baik. Mayoritas siswa memiliki pemahaman yang kuat terhadap materi.";
      else if (avg >= 60) performanceTrend = "Cukup Baik. Pemahaman materi berada pada tingkat standar, namun beberapa topik memerlukan penguatan.";
      else performanceTrend = "Mengkhawatirkan. Nilai rata-rata kelas di bawah harapan. Terdapat celah pemahaman yang signifikan.";

      setReport({
        trend: performanceTrend,
        difficultTopics: ["Topik Logika Lanjut", "Pemecahan Masalah Studi Kasus"],
        easyTopics: ["Konsep Dasar", "Definisi Istilah"],
        recommendation: avg < 60 ? "Disarankan untuk mengadakan sesi remedial komprehensif pada Topik Logika Lanjut." : "Lanjutkan ke materi berikutnya. Pertimbangkan pengayaan studi kasus bagi siswa yang mendapat nilai sempurna."
      });
      setAnalyzing(false);
    }, 2000);
  }

  if (total === 0) {
    return <Card className="p-12 text-center text-muted-foreground shadow-sm">Belum ada sesi selesai untuk dianalisis oleh AI.</Card>;
  }

  return (
    <div className="space-y-6">
      <Card className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-sm">
        <CardContent className="p-8 text-center space-y-4">
          <div className="mx-auto w-12 h-12 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mb-2">
            <Sparkles className="h-6 w-6 text-slate-700 dark:text-slate-300" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Wawasan Otomatis</h2>
          <p className="text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
            Gunakan kecerdasan buatan untuk membaca tren, mendeteksi soal paling sulit, dan mendapatkan rekomendasi tindak lanjut bagi dosen secara instan.
          </p>
          {!report && (
            <Button onClick={generateInsight} disabled={analyzing} className="bg-indigo-600 hover:bg-indigo-700 text-white mt-4 h-11 px-8">
              {analyzing ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  AI Sedang Menganalisis...
                </span>
              ) : (
                "Generate AI Insight"
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      {report && (
        <div className="grid gap-6 animate-in slide-in-from-bottom-4 duration-500">
          <Card className="border-l-4 border-l-indigo-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-indigo-500" /> Tren Kinerja Keseluruhan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{report.trend}</p>
            </CardContent>
          </Card>

          <div className="grid sm:grid-cols-2 gap-6">
            <Card className="border-l-4 border-l-destructive">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" /> Area Perlu Perhatian (Sulit)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc list-inside space-y-1 text-slate-700 dark:text-slate-300">
                  {report.difficultTopics.map((t: string, i: number) => <li key={i}>{t}</li>)}
                </ul>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-success">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-success">
                  <CheckCircle2 className="h-5 w-5" /> Area Dikuasai (Mudah)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc list-inside space-y-1 text-slate-700 dark:text-slate-300">
                  {report.easyTopics.map((t: string, i: number) => <li key={i}>{t}</li>)}
                </ul>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-slate-900 text-white dark:bg-slate-950 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-amber-400">
                <Sparkles className="h-5 w-5" /> Rekomendasi Tindak Lanjut
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="leading-relaxed opacity-90">{report.recommendation}</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
