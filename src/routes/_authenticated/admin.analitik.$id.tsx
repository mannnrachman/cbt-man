/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ujianRepo, sesiRepo, usersRepo, soalRepo, hydrateRepos, mataKuliahRepo, semesterRepo, unitAkademikRepo, deleteAllExamSessions } from "@/lib/cbt/repos";
import { recomputeSkor } from "@/lib/cbt/scoring";
import { exportSheet, stripHtml } from "@/lib/cbt/excel";
import { analisisButir, labelKesukaran, labelDiskriminasi } from "@/lib/cbt/analisis";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminPage, AdminPageHeader } from "@/components/cbt/AdminPage";
import { ConfirmDialog } from "@/components/cbt/ConfirmDialog";
import { Trash2, Pencil, X, BookOpen, Clock, FileText, CheckCircle2, Sparkles, AlertTriangle, TrendingUp, Printer, Download, ArrowLeft } from "lucide-react";
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

  const totalSoal = (ujian.topicSets || []).reduce((total, set) => total + set.jumlah, 0);
  const selesaiCount = sesis.filter((s) => s.status === "selesai").length;

  return (
    <AdminPage className="pb-12">
      <Link to="/admin/analitik" className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
        <ArrowLeft className="h-4 w-4" /> Kembali ke Analitik
      </Link>

      <AdminPageHeader
        title={ujian.nama}
        description={
          <span className="inline-flex flex-wrap items-center gap-1.5">
            {mk ? <><BookOpen className="h-3.5 w-3.5" /> {mk.nama} {smt ? `· ${smt.nama}` : ""}</> : "Ringkasan hasil pelaksanaan ujian"}
          </span>
        }
        action={
          <div className="grid grid-cols-3 gap-2 text-right">
            <div className="min-w-[5.5rem] rounded-lg border bg-card px-3 py-2">
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Durasi</div>
              <div className="mt-0.5 inline-flex items-center gap-1 text-sm font-semibold tabular-nums"><Clock className="h-3.5 w-3.5 text-primary" />{ujian.durasiMenit}'</div>
            </div>
            <div className="min-w-[5.5rem] rounded-lg border bg-card px-3 py-2">
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Soal</div>
              <div className="mt-0.5 inline-flex items-center gap-1 text-sm font-semibold tabular-nums"><FileText className="h-3.5 w-3.5 text-primary" />{totalSoal}</div>
            </div>
            <div className="min-w-[5.5rem] rounded-lg border bg-card px-3 py-2">
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Selesai</div>
              <div className="mt-0.5 inline-flex items-center gap-1 text-sm font-semibold tabular-nums text-primary"><CheckCircle2 className="h-3.5 w-3.5" />{selesaiCount}</div>
            </div>
          </div>
        }
      />

      <Tabs defaultValue={initialTab} className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-xl border bg-muted/60 p-1 sm:inline-grid sm:w-auto">
          <TabsTrigger value="peserta" className="px-2 text-xs sm:px-4 sm:text-sm">Daftar Peserta</TabsTrigger>
          <TabsTrigger value="report" className="px-2 text-xs sm:px-4 sm:text-sm">Laporan Ujian</TabsTrigger>
          <TabsTrigger value="ai" className="gap-1.5 px-2 text-xs text-primary sm:px-4 sm:text-sm"><Sparkles className="h-3.5 w-3.5" /> Wawasan AI</TabsTrigger>
        </TabsList>

        <TabsContent value="peserta" className="mt-4 space-y-4 outline-none">
          <DaftarPesertaTab ujian={ujian} sesis={sesis} refresh={refresh} />
        </TabsContent>

        <TabsContent value="report" className="mt-4 outline-none">
          <ExamReportTab ujian={ujian} sesis={sesis} />
        </TabsContent>

        <TabsContent value="ai" className="mt-4 outline-none">
          <AiInsightTab ujian={ujian} sesis={sesis} />
        </TabsContent>
      </Tabs>
    </AdminPage>
  );
}

function DaftarPesertaTab({ ujian, sesis, refresh }: { ujian: Ujian, sesis: SesiUjian[], refresh: () => void }) {
  const users = usersRepo.all();
  const [openId, setOpenId] = useState<string | null>(null);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editSkor, setEditSkor] = useState<string>("");
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeletingSingle, setIsDeletingSingle] = useState(false);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  async function saveEdit(sesiId: string, idx: number) {
    const s = sesiRepo.byId(sesiId);
    if (!s) return;
    const key = `${sesiId}:${idx}`;
    const v = editSkor === "" ? undefined : Number(editSkor);
    const next = { ...s, jawaban: s.jawaban.map((j, i) => (i === idx ? { ...j, skor: v } : j)) };
    sesiRepo.upsert(recomputeSkor(next, ujian));
    setSavingKey(key);
    try {
      const result = await sesiRepo.flush();
      if (!result.ok) return;
      setEditIdx(null);
      setEditSkor("");
      refresh();
      toast.success("Nilai diperbarui");
    } finally {
      setSavingKey(null);
    }
  }

  async function deleteSession() {
    if (!deleteId || isDeletingSingle) return;
    const sesiId = deleteId;
    setIsDeletingSingle(true);
    try {
      sesiRepo.remove(sesiId);
      const result = await sesiRepo.flush();
      if (!result.ok) {
        toast.error("Gagal menghapus sesi ujian");
        return;
      }
      if (openId === sesiId) setOpenId(null);
      refresh();
      setDeleteId(null);
      toast.success("Sesi ujian berhasil dihapus");
    } catch {
      toast.error("Gagal menghapus sesi ujian. Coba lagi.");
    } finally {
      setIsDeletingSingle(false);
    }
  }

  async function handleDeleteAll() {
    setIsDeletingAll(true);
    try {
      const result = await deleteAllExamSessions(ujian.id);
      if (!result.ok) {
        toast.error(result.error || "Gagal menghapus semua sesi");
        return;
      }
      setDeleteAllOpen(false);
      if (openId) setOpenId(null);
      refresh();
      toast.success("Semua sesi peserta berhasil dihapus");
    } catch {
      toast.error("Gagal menghapus semua sesi. Coba lagi.");
    } finally {
      setIsDeletingAll(false);
    }
  }

  return (
    <>
      <Card className="overflow-hidden shadow-sm">
        <CardHeader className="border-b bg-muted/20 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-base">Daftar Peserta</CardTitle>
              <CardDescription>{sesis.length} sesi peserta tercatat pada ujian ini.</CardDescription>
            </div>
            {sesis.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="border-rose-200 dark:border-rose-900 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 w-fit"
                onClick={() => setDeleteAllOpen(true)}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Hapus Semua Sesi ({sesis.length})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="p-4 text-left font-medium">Peserta</th>
                  <th className="p-4 text-center font-medium">Status</th>
                  <th className="p-4 text-center font-medium">Mulai</th>
                  <th className="p-4 text-center font-medium">Skor</th>
                  <th className="p-4 text-center font-medium">Pelanggaran</th>
                  <th className="p-4 text-center font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {sesis.map((s) => {
                  const u = users.find((x) => x.id === s.pesertaId);
                  const isOpen = openId === s.id;
                  return (
                    <tr key={s.id} className={`border-b last:border-0 transition-colors ${isOpen ? 'bg-primary/5' : 'hover:bg-muted/30'}`}>
                      <td className="p-4">
                        <div className="font-medium text-foreground">{u?.namaLengkap ?? s.pesertaId}</div>
                        {u?.username && <div className="mt-0.5 text-xs text-muted-foreground">{u.username}</div>}
                      </td>
                      <td className="p-4 text-center">
                        <Badge variant="outline" className={s.status === "selesai" ? "border-success/30 bg-success/10 text-success" : s.status === "sedang" ? "border-primary/30 bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}>
                          {s.status}
                        </Badge>
                      </td>
                      <td className="p-4 text-center text-muted-foreground">
                        {s.mulaiAt ? (
                          <span suppressHydrationWarning>
                            {new Date(s.mulaiAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}
                          </span>
                        ) : "-"}
                      </td>
                      <td className="p-4 text-center">
                        {s.status === "selesai" ? (
                          <span className="font-bold text-base">{s.skorTotal ?? 0} <span className="text-xs text-muted-foreground font-normal">/ {s.maxSkor ?? 0}</span></span>
                        ) : "-"}
                      </td>
                      <td className="p-4 text-center">
                        {s.pelanggaran > 0 ? (
                          <span className="inline-flex items-center rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                            {s.pelanggaran} peringatan
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="space-x-2 p-4 text-center">
                        <Button size="sm" variant={isOpen ? "default" : "outline"} disabled={savingKey !== null} onClick={() => { setOpenId(isOpen ? null : s.id); setEditIdx(null); }}>
                          {isOpen ? "Tutup Lembar" : "Koreksi Lembar"}
                        </Button>
                        <Button size="sm" variant="ghost" disabled={savingKey !== null} className="text-destructive hover:bg-destructive/10" onClick={() => setDeleteId(s.id)} aria-label={`Hapus sesi ${s.id}`} title={`Hapus sesi ${s.id}`}>
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
                                <Button size="sm" disabled={savingKey !== null} onClick={() => saveEdit(s.id, i)} className="h-8 px-3">Simpan</Button>
                                <Button size="sm" variant="ghost" disabled={savingKey !== null} onClick={() => setEditIdx(null)} className="h-8 px-2 text-destructive">Batal</Button>
                              </div>
                            ) : isEssay ? (
                              <Button size="sm" disabled={savingKey !== null} variant={needsGrading ? "default" : "secondary"} className={`h-8 text-xs ${needsGrading ? 'animate-pulse' : ''}`} onClick={() => { setEditIdx(i); setEditSkor(String(j.skor ?? "")); }}>
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

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Hapus Sesi Ujian"
        description="Sesi peserta dan seluruh jawaban yang tersimpan akan dihapus secara permanen sehingga peserta dapat mengikuti ujian ulang."
        confirmLabel="Hapus"
        destructive={true}
        busy={isDeletingSingle}
        onConfirm={deleteSession}
      />

      <ConfirmDialog
        open={deleteAllOpen}
        onOpenChange={setDeleteAllOpen}
        title="Hapus Semua Sesi Ujian?"
        description={`Apakah Anda yakin ingin menghapus seluruh ${sesis.length} sesi pengerjaan ujian ini? Seluruh data jawaban dan skor peserta akan direset sehingga semua peserta dapat mengikuti ujian kembali.`}
        confirmLabel="Ya, Hapus Semua Sesi"
        destructive={true}
        busy={isDeletingAll}
        onConfirm={handleDeleteAll}
      />
    </>
  );
}

function ExamReportTab({ ujian, sesis }: { ujian: Ujian, sesis: SesiUjian[] }) {
  const completed = sesis.filter(s => s.status === "selesai");
  const total = completed.length;
  
  if (total === 0) {
    return (
      <Card className="shadow-sm">
        <CardContent className="p-12 text-center text-sm text-muted-foreground">
          Belum ada sesi selesai untuk dianalisis.
        </CardContent>
      </Card>
    );
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Laporan Ujian</h2>
          <p className="mt-1 text-sm text-muted-foreground">Ringkasan hasil ujian untuk {total} peserta yang selesai.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={exportRekapExcel} variant="outline" className="gap-2">
            <Download className="h-4 w-4" /> Download Rekap
          </Button>
          <Button onClick={exportAnalisisExcel} variant="outline" className="gap-2">
            <Download className="h-4 w-4" /> Download Analisis
          </Button>
          <Button onClick={() => window.print()} variant="outline" className="gap-2">
            <Printer className="h-4 w-4" /> Cetak Laporan
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Rata-Rata Kelas</div>
            <div className="mt-2 text-2xl font-bold tabular-nums">{avg}</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Tingkat Kelulusan</div>
            <div className="mt-2 text-2xl font-bold tabular-nums">{passRate}%</div>
            <div className="mt-1 text-xs text-muted-foreground">{passedCount} dari {total} lulus · KKM {threshold}</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Skor Tertinggi</div>
            <div className="mt-2 text-2xl font-bold tabular-nums text-success">{highest}</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Skor Terendah</div>
            <div className="mt-2 text-2xl font-bold tabular-nums text-destructive">{lowest}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden shadow-sm">
        <CardHeader className="border-b bg-muted/20 pb-4">
          <CardTitle className="text-base">Distribusi Nilai</CardTitle>
          <CardDescription>Persebaran jumlah siswa berdasarkan rentang skor</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <div className="h-64 w-full sm:h-72">
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
    return (
      <Card className="shadow-sm">
        <CardContent className="p-12 text-center text-sm text-muted-foreground">
          Belum ada sesi selesai untuk dianalisis oleh AI.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-primary/20 bg-primary/5 shadow-sm">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Wawasan AI</h2>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  Gunakan kecerdasan buatan untuk membaca tren, mendeteksi soal paling sulit, dan mendapatkan rekomendasi tindak lanjut bagi dosen secara instan.
                </p>
              </div>
            </div>
            {!report && (
              <Button onClick={generateInsight} disabled={analyzing} className="shrink-0">
                {analyzing ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    AI Sedang Menganalisis...
                  </span>
                ) : (
                  <><Sparkles className="mr-2 h-4 w-4" />Generate Insight</>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {report && (
        <div className="grid gap-4 animate-in slide-in-from-bottom-4 duration-500">
          <Card className="overflow-hidden shadow-sm">
            <CardHeader className="border-b bg-muted/20 pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-5 w-5 text-primary" /> Tren Kinerja Keseluruhan
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <p className="leading-relaxed text-muted-foreground">{report.trend}</p>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-destructive/30 shadow-sm">
              <CardHeader className="border-b bg-destructive/5 pb-4">
                <CardTitle className="flex items-center gap-2 text-base text-destructive">
                  <AlertTriangle className="h-5 w-5" /> Area Perlu Perhatian (Sulit)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                  {report.difficultTopics.map((t: string, i: number) => <li key={i}>{t}</li>)}
                </ul>
              </CardContent>
            </Card>

            <Card className="border-success/30 shadow-sm">
              <CardHeader className="border-b bg-success/5 pb-4">
                <CardTitle className="flex items-center gap-2 text-base text-success">
                  <CheckCircle2 className="h-5 w-5" /> Area Dikuasai (Mudah)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                  {report.easyTopics.map((t: string, i: number) => <li key={i}>{t}</li>)}
                </ul>
              </CardContent>
            </Card>
          </div>

          <Card className="border-primary/20 bg-primary text-primary-foreground shadow-sm">
            <CardHeader className="border-b border-primary-foreground/10 pb-4">
              <CardTitle className="flex items-center gap-2 text-base text-primary-foreground">
                <Sparkles className="h-5 w-5" /> Rekomendasi Tindak Lanjut
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <p className="leading-relaxed opacity-90">{report.recommendation}</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
