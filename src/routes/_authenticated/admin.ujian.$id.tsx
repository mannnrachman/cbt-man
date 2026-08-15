import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ujianRepo, unitAkademikRepo, hydrateRepos, mataKuliahRepo, semesterRepo } from "@/lib/cbt/repos";
import { uid } from "@/lib/cbt/storage";
import type { Ujian, TopicSet } from "@/lib/cbt/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Save, Lock, ArrowLeft, Layers, ShieldCheck, Calculator, FileText, FileSignature, Settings2, Users } from "lucide-react";
import { toast } from "sonner";
import { RichEditor } from "@/components/cbt/RichEditor";
import { TokenManager } from "@/components/cbt/TokenManager";
import { useAuthStore } from "@/lib/cbt/auth-store";
import {
  allowedTopikIdSet,
  isTopikAllowed,
  ujianTouchesAllowed,
  visibleModuls,
  visibleTopiks,
} from "@/lib/cbt/access";
import { fetchUjianByIdServer } from "@/lib/server/ujian/functions";

export const Route = createFileRoute("/_authenticated/admin/ujian/$id")({
  loader: async () => {
    try {
      await hydrateRepos();
    } catch {
      // Fallback ke cache; jangan brick navigasi saat snapshot gagal.
    }
  },
  component: UjianEditor,
});

function toLocalDatetimeString(ms?: number) {
  if (!ms) return "";
  const d = new Date(ms);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalDatetimeString(s: string) {
  if (!s) return undefined;
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d.getTime();
}

function UjianEditor() {
  const { id } = useParams({ from: "/_authenticated/admin/ujian/$id" });
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const initial = ujianRepo.byId(id);
  
  const mkList = mataKuliahRepo.all();
  const smtList = semesterRepo.all();

  const [authReady, setAuthReady] = useState(user != null);
  useEffect(() => {
    if (user != null) setAuthReady(true);
  }, [user]);

  const [u, setU] = useState<Ujian | null>(initial ?? null);
  const [loadingRemote, setLoadingRemote] = useState(initial === undefined);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!authReady || !user || !initial) return;
    if (!ujianTouchesAllowed(user, initial)) {
      setU(null);
      setDenied(true);
    }
  }, [authReady, user, initial]);

  useEffect(() => {
    if (initial !== undefined) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await fetchUjianByIdServer({ data: { id } });
        if (cancelled) return;
        if (result.ok && result.ujian) {
          if (ujianTouchesAllowed(user, result.ujian)) {
            setU(result.ujian);
          } else {
            setDenied(true);
          }
        } else if (result.error === "Forbidden") {
          setDenied(true);
        }
      } catch {
        // Network/server error fallback
      } finally {
        if (!cancelled) setLoadingRemote(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, initial, user]);

  if (loadingRemote) {
    return <div className="p-8 text-sm text-muted-foreground">Memuat paket ujian…</div>;
  }

  if (denied && !u) {
    return (
      <div className="space-y-4 max-w-2xl p-6">
        <Link to="/admin/ujian" className="text-sm text-muted-foreground hover:underline inline-flex items-center gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Kembali ke Manajemen Ujian
        </Link>
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-5 text-sm">
          <div className="flex items-center gap-2 font-semibold text-destructive">
            <Lock className="h-5 w-5" />
            Akses Ditolak
          </div>
          <p className="mt-2 text-muted-foreground leading-relaxed">
            Anda tidak memiliki izin untuk mengelola atau melihat paket ujian ini karena topik berada di luar cakupan wewenang Anda.
          </p>
        </div>
      </div>
    );
  }

  if (!u) {
    return (
      <div className="p-8 space-y-3">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Paket ujian tidak ditemukan.</p>
        <Link to="/admin/ujian" className="text-sm font-semibold text-primary hover:underline inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Kembali ke Daftar Ujian
        </Link>
      </div>
    );
  }

  const groups = unitAkademikRepo.all();
  const topiks = visibleTopiks(user);
  const moduls = visibleModuls(user);
  
  const sortedTopiks = [...topiks].sort((a, b) => {
    const mA = moduls.find((m) => m.id === a.modulId);
    const mB = moduls.find((m) => m.id === b.modulId);
    const aIsMk = mA?.mataKuliahId === u?.mataKuliahId ? -1 : 1;
    const bIsMk = mB?.mataKuliahId === u?.mataKuliahId ? -1 : 1;
    if (aIsMk !== bIsMk) return aIsMk - bIsMk;
    return a.nama.localeCompare(b.nama);
  });
  
  const allowedSet = allowedTopikIdSet(user);

  function set<K extends keyof Ujian>(k: K, v: Ujian[K]) {
    setU({ ...u!, [k]: v });
  }

  function addTopicSet() {
    if (topiks.length === 0) {
      toast.error("Buat topik soal terlebih dahulu");
      return;
    }
    const ts: TopicSet = {
      id: uid("ts_"),
      topikId: topiks[0].id,
      jumlah: 5,
      jumlahOpsi: 4,
      acakSoal: true,
      acakJawaban: true,
    };
    set("topicSets", [...u!.topicSets, ts]);
  }

  async function save() {
    if (!u!.nama.trim()) {
      toast.error("Nama ujian wajib diisi");
      return;
    }
    if (allowedSet) {
      const outOfScope = u!.topicSets.filter((ts) => !allowedSet.has(ts.topikId));
      if (outOfScope.length > 0) {
        toast.error("Ada topik set di luar wewenang Anda");
        return;
      }
    }
    ujianRepo.upsert(u!);
    await ujianRepo.flush();
    toast.success("Perubahan ujian berhasil disimpan");
    navigate({ to: "/admin/ujian" });
  }

  async function hapus() {
    if (!confirm(`Yakin ingin menghapus ujian "${u!.nama}" beserta seluruh data yang terkait?`)) return;
    ujianRepo.remove(u!.id);
    await ujianRepo.flush();
    toast.success("Ujian berhasil dihapus");
    navigate({ to: "/admin/ujian" });
  }

  const totalSoal = u.topicSets.reduce((acc, ts) => acc + (Number(ts.jumlah) || 0), 0);

  return (
    <div className="space-y-6 w-full max-w-[1600px] mx-auto pb-12">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div>
          <Link to="/admin/ujian" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors mb-1.5">
            <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Manajemen Ujian
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
              <FileSignature className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Editor Paket Ujian</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">{u.nama || "Ujian Baru"}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <Button variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10 h-9 text-xs" onClick={hapus}>
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Hapus Paket
          </Button>
          <Button onClick={save} className="h-9 text-xs font-semibold shadow-xs">
            <Save className="mr-1.5 h-3.5 w-3.5" />
            Simpan Perubahan
          </Button>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

        {/* LEFT COLUMN: Informasi Utama, Topic Sets, Token (7 cols) */}
        <div className="xl:col-span-7 space-y-6">

          {/* Card 1: Informasi Utama */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-slate-900 dark:text-slate-100 font-semibold">
                <FileText className="h-4 w-4 text-primary" />
                Informasi Utama
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Nama Paket Ujian *</Label>
                <Input
                  value={u.nama}
                  onChange={(e) => set("nama", e.target.value)}
                  placeholder="Contoh: Ujian Tengah Semester Farmakologi"
                  className="font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Deskripsi / Petunjuk Ujian</Label>
                <RichEditor
                  value={u.deskripsi}
                  onChange={(v) => set("deskripsi", v)}
                  minHeight={100}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Mata Kuliah</Label>
                  <Select
                    value={u.mataKuliahId || "none"}
                    onValueChange={(v) => set("mataKuliahId", v === "none" ? undefined : v)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Pilih Mata Kuliah" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">(Tanpa Mata Kuliah)</SelectItem>
                      {mkList.map((mk) => (
                        <SelectItem key={mk.id} value={mk.id}>
                          {mk.nama}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Semester</Label>
                  <Select
                    value={u.semesterId || "none"}
                    onValueChange={(v) => set("semesterId", v === "none" ? undefined : v)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Pilih Semester" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">(Tanpa Semester)</SelectItem>
                      {smtList.map((smt) => (
                        <SelectItem key={smt.id} value={smt.id}>
                          {smt.nama}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Komposisi Soal (Topic Sets) */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2 text-slate-900 dark:text-slate-100 font-semibold">
                  <Layers className="h-4 w-4 text-primary" />
                  Komposisi Soal & Topik
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Total butir soal yang dirakit: <span className="font-bold text-foreground">{totalSoal} Soal</span>
                </p>
              </div>
              <Button size="sm" onClick={addTopicSet} className="h-8 text-xs">
                <Plus className="mr-1 h-3.5 w-3.5" />
                Tambah Topik
              </Button>
            </CardHeader>
            <CardContent className="p-5 space-y-3">
              {u.topicSets.map((ts, i) => {
                const t = topiks.find((tk) => tk.id === ts.topikId);
                const m = t ? moduls.find((mm) => mm.id === t.modulId) : null;
                const inScope = isTopikAllowed(user, ts.topikId);

                return (
                  <div key={ts.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 bg-slate-50/30 dark:bg-slate-900/30">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                      <div className="sm:col-span-8 space-y-1.5">
                        <Label className="text-xs font-medium">Pilih Topik Soal</Label>
                        <Select
                          value={ts.topikId}
                          onValueChange={(v) =>
                            set(
                              "topicSets",
                              u.topicSets.map((x, idx) => (idx === i ? { ...x, topikId: v } : x)),
                            )
                          }
                        >
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {sortedTopiks.map((tk) => {
                              const mm = moduls.find((mm) => mm.id === tk.modulId);
                              const isMatchMk = u.mataKuliahId && mm?.mataKuliahId === u.mataKuliahId;
                              return (
                                <SelectItem key={tk.id} value={tk.id} className="text-xs">
                                  {isMatchMk ? "★ " : ""}{mm?.nama} → {tk.nama}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="sm:col-span-3 space-y-1.5">
                        <Label className="text-xs font-medium">Jumlah Soal</Label>
                        <Input
                          type="number"
                          min={1}
                          value={ts.jumlah}
                          onChange={(e) =>
                            set(
                              "topicSets",
                              u.topicSets.map((x, idx) =>
                                idx === i ? { ...x, jumlah: Number(e.target.value) } : x,
                              ),
                            )
                          }
                          className="h-9 text-xs font-medium"
                        />
                      </div>

                      <div className="sm:col-span-1 flex justify-end">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 text-slate-400 hover:text-destructive hover:bg-destructive/10"
                          onClick={() =>
                            set(
                              "topicSets",
                              u.topicSets.filter((_, idx) => idx !== i),
                            )
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={ts.acakSoal}
                            onCheckedChange={(v) =>
                              set(
                                "topicSets",
                                u.topicSets.map((x, idx) => (idx === i ? { ...x, acakSoal: !!v } : x)),
                              )
                            }
                          />
                          <span className="text-xs text-slate-600 dark:text-slate-400">Acak Urutan Soal</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={ts.acakJawaban}
                            onCheckedChange={(v) =>
                              set(
                                "topicSets",
                                u.topicSets.map((x, idx) => (idx === i ? { ...x, acakJawaban: !!v } : x)),
                              )
                            }
                          />
                          <span className="text-xs text-slate-600 dark:text-slate-400">Acak Opsi Pilihan</span>
                        </label>
                      </div>

                      <div className="text-slate-400 text-[11px]">
                        Modul: <span className="text-slate-600 dark:text-slate-300 font-medium">{m?.nama || "-"}</span>
                        {!inScope && (
                          <span className="ml-2 px-1.5 py-0.5 rounded bg-destructive/10 text-destructive text-[10px] font-semibold">
                            Di luar wewenang
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {u.topicSets.length === 0 && (
                <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-500 text-xs">
                  Belum ada topik soal yang ditambahkan. Klik tombol &ldquo;Tambah Topik&rdquo; di atas untuk memilih bank soal.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card 3: Kelola Token Terintegrasi */}
          <TokenManager ujian={u} />
        </div>

        {/* RIGHT COLUMN: Konfigurasi, Keamanan, Target Peserta (5 cols) */}
        <div className="xl:col-span-5 space-y-6">

          {/* Card 4: Konfigurasi Waktu & Skoring */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-slate-900 dark:text-slate-100 font-semibold">
                <Settings2 className="h-4 w-4 text-primary" />
                Jadwal & Skoring
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Durasi Ujian (Menit) *</Label>
                <Input
                  type="number"
                  min={1}
                  value={u.durasiMenit}
                  onChange={(e) => set("durasiMenit", Math.max(1, Number(e.target.value)))}
                  className="h-9 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Jadwal Mulai</Label>
                  <Input
                    type="datetime-local"
                    value={toLocalDatetimeString(u.beginAt)}
                    onChange={(e) => set("beginAt", fromLocalDatetimeString(e.target.value))}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Jadwal Selesai</Label>
                  <Input
                    type="datetime-local"
                    value={toLocalDatetimeString(u.endAt)}
                    onChange={(e) => set("endAt", fromLocalDatetimeString(e.target.value))}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="pt-2">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Bobot Nilai Jawaban</Label>
                <div className="grid grid-cols-3 gap-2 mt-1.5">
                  <div className="space-y-1">
                    <span className="text-[11px] text-slate-500">Poin Benar</span>
                    <Input
                      type="number"
                      value={u.poinBenar}
                      onChange={(e) => set("poinBenar", Number(e.target.value))}
                      className="h-8 text-xs text-center font-bold text-emerald-600"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-slate-500">Poin Salah</span>
                    <Input
                      type="number"
                      value={u.poinSalah}
                      onChange={(e) => set("poinSalah", Number(e.target.value))}
                      className="h-8 text-xs text-center font-bold text-rose-600"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-slate-500">Poin Kosong</span>
                    <Input
                      type="number"
                      value={u.poinKosong}
                      onChange={(e) => set("poinKosong", Number(e.target.value))}
                      className="h-8 text-xs text-center font-bold text-slate-600"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 5: Fitur, Alat Bantu & Keamanan */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-slate-900 dark:text-slate-100 font-semibold">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Fitur & Keamanan Ujian
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-3.5">
              <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40">
                <div>
                  <Label className="text-xs font-semibold cursor-pointer">Wajib Token Ujian</Label>
                  <p className="text-[11px] text-muted-foreground">Peserta harus memasukkan token sebelum memulai</p>
                </div>
                <Switch checked={u.tokenAktif} onCheckedChange={(v) => set("tokenAktif", v)} />
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40">
                <div>
                  <Label className="text-xs font-semibold cursor-pointer flex items-center gap-1.5">
                    <Calculator className="h-3.5 w-3.5 text-primary" /> Kalkulator Ilmiah
                  </Label>
                  <p className="text-[11px] text-muted-foreground">Tampilkan tombol kalkulator ilmiah di layar ujian</p>
                </div>
                <Switch checked={u.allowCalculator} onCheckedChange={(v) => set("allowCalculator", v)} />
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40">
                <div>
                  <Label className="text-xs font-semibold cursor-pointer flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-primary" /> Tabel Nilai Normal
                  </Label>
                  <p className="text-[11px] text-muted-foreground">Tampilkan lembar rujukan nilai normal laboratorium</p>
                </div>
                <Switch checked={u.allowNilaiNormal} onCheckedChange={(v) => set("allowNilaiNormal", v)} />
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                <div>
                  <Label className="text-xs font-medium cursor-pointer">Tampilkan Skor Akhir</Label>
                  <p className="text-[11px] text-muted-foreground">Peserta melihat skor langsung setelah submit</p>
                </div>
                <Switch checked={u.showResult} onCheckedChange={(v) => set("showResult", v)} />
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                <div>
                  <Label className="text-xs font-medium cursor-pointer">Tampilkan Kunci & Pembahasan</Label>
                  <p className="text-[11px] text-muted-foreground">Peserta dapat meninjau rincian soal setelah ujian</p>
                </div>
                <Switch checked={u.showResultDetail} onCheckedChange={(v) => set("showResultDetail", v)} />
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                <div>
                  <Label className="text-xs font-medium cursor-pointer">Wajib Layar Penuh (Fullscreen)</Label>
                  <p className="text-[11px] text-muted-foreground">Kunci browser ke mode layar penuh</p>
                </div>
                <Switch checked={u.fullscreenWajib} onCheckedChange={(v) => set("fullscreenWajib", v)} />
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                <div>
                  <Label className="text-xs font-medium cursor-pointer">Blokir Shortcut & Klik Kanan</Label>
                  <p className="text-[11px] text-muted-foreground">Cegah copy, paste, dan inspeksi elemen</p>
                </div>
                <Switch checked={u.blokirShortcut} onCheckedChange={(v) => set("blokirShortcut", v)} />
              </div>

              <div className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 space-y-1.5">
                <Label className="text-xs font-medium">Batas Maksimal Pindah Tab</Label>
                <Input
                  type="number"
                  min={0}
                  value={u.maxPindahTab}
                  onChange={(e) => set("maxPindahTab", Number(e.target.value))}
                  className="h-8 text-xs"
                />
                <p className="text-[10px] text-slate-400">Ujian otomatis disubmit paksa bila pelanggaran melampaui batas ini.</p>
              </div>
            </CardContent>
          </Card>

          {/* Card 6: Target Peserta (Grup / Rombel) */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-slate-900 dark:text-slate-100 font-semibold">
                <Users className="h-4 w-4 text-primary" />
                Target Peserta Ujian
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-2">
              <p className="text-xs text-muted-foreground mb-2">
                Pilih unit / kelas yang diizinkan mengikuti ujian (kosongkan jika terbuka untuk seluruh peserta):
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
                {groups.map((g) => (
                  <label key={g.id} className="flex items-center gap-2 rounded-lg border border-slate-100 dark:border-slate-800 p-2 text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                    <Checkbox
                      checked={u.groupIds.includes(g.id)}
                      onCheckedChange={(v) =>
                        set(
                          "groupIds",
                          v ? [...u.groupIds, g.id] : u.groupIds.filter((x) => x !== g.id),
                        )
                      }
                    />
                    <span className="truncate">{g.nama}</span>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

        </div>

      </div>
    </div>
  );
}
