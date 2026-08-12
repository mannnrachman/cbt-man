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
import { Plus, Trash2, Save, Lock, KeyRound, ArrowLeft, FileText, Layers, Award, Users, Wrench, ShieldAlert, FileSignature } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/admin/ujian/$id/")({
  loader: async () => {
    try {
      await hydrateRepos();
    } catch {
      // Fallback ke cache; jangan brick navigasi saat snapshot gagal.
    }
  },
  component: UjianEditor,
});

function UjianEditor() {
  const { id } = useParams({ from: "/_authenticated/admin/ujian/$id/" });
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const initial = ujianRepo.byId(id);
  
  const mkList = mataKuliahRepo.all();
  const smtList = semesterRepo.all();

  // (Must-fix #2) Re-order guards so `ujianTouchesAllowed` runs BEFORE we
  // initialize `useState` with the full ujian. If the snapshot already
  // carries the ujian and it is out of scope, we must not store it in
  // state — otherwise a subsequent re-render that races with a state
  // reset could leak exam metadata into memory.
  //
  // (Must-fix #3) When the snapshot does NOT carry the ujian, we ask the
  // server for a direct-URL fetch so we can distinguish three cases:
  //   1. ujian exists and is fully in scope     -> normal editor
  //   2. ujian exists but is partially out of scope -> lock screen
  //   3. ujian does not exist                   -> "tidak ditemukan"
  // The previous behaviour conflated 2 and 3, which was the must-fix.
  //
  // Important: `useAuthStore` may hydrate asynchronously, so `user` can
  // be `null` on the very first render. We must NOT call
  // `ujianTouchesAllowed` against a null user at render time — that
  // would return `false` for every operator and trigger the lock
  // screen even when the operator is allowed. Instead, wait for the
  // auth store to settle (the route's `beforeLoad` already ensures a
  // valid user; the only race is the first paint).
  const [authReady, setAuthReady] = useState(user != null);
  useEffect(() => {
    if (user != null) setAuthReady(true);
  }, [user]);

  // When the auth store is not ready yet, we don't know whether the
  // operator is allowed. We optimistically keep the ujian in state so
  // the editor paints immediately; the `ujianTouchesAllowed` check
  // will re-fire on the next render once `user` resolves. This avoids
  // a flash of the lock screen for legitimate users.
  const initialAllowed =
    !authReady || !user || !initial
      ? true // unknown / admin-like — keep the ujian in state for the first paint
      : ujianTouchesAllowed(user, initial);
  const [u, setU] = useState<Ujian | null>(initial ?? null);
  const [loadingRemote, setLoadingRemote] = useState(initial === undefined);
  const [denied, setDenied] = useState(false);
  // After the auth store hydrates, re-evaluate the access check. If the
  // operator is out of scope, flip to the lock screen.
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
        // "Not found" / "Unauthorized" fall through with u=null and denied=false.
      } catch {
        // Network/server error: fall through to "tidak ditemukan" so the
        // operator sees a stable empty state instead of a stuck spinner.
      } finally {
        if (!cancelled) setLoadingRemote(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, initial, user]);

  // Loading state while we resolve direct-URL exam existence.
  if (loadingRemote) {
    return <div className="text-sm text-muted-foreground">Memuat…</div>;
  }

  // (Must-fix #2 + #3) Lock screen — fires for both "exists but blocked"
  // and the edge case where the snapshot was empty but the server confirms
  // the ujian exists out of scope.
  if (denied && !u) {
    return (
      <div className="space-y-3 max-w-2xl">
        <Link to="/admin/ujian" className="text-sm text-muted-foreground hover:underline">
          ← Paket ujian
        </Link>
        <div className="rounded-md border bg-muted/30 p-4 text-sm">
          <div className="flex items-center gap-2 font-medium">
            <Lock className="h-4 w-4" />
            Anda tidak memiliki akses ke ujian ini.
          </div>
          <p className="mt-1 text-muted-foreground">
            Ujian ini menyentuh topik di luar cakupan <code>allowedTopikIds</code> Anda. Hubungi
            admin jika menurut Anda ini keliru.
          </p>
        </div>
      </div>
    );
  }

  if (!u) {
    return (
      <div>
        Ujian tidak ditemukan.{" "}
        <Link to="/admin/ujian" className="text-primary">
          Kembali
        </Link>
      </div>
    );
  }

  // If we reach this branch, either the snapshot already had the ujian
  // and `ujianTouchesAllowed` returned true at construction time, or the
  // server-side direct-URL fetch returned a fully in-scope ujian. The
  // `ujianTouchesAllowed` guard is now hoisted above `useState`, so by
  // construction `u` is touchable. (A subsequent state mutation of
  // `user` cannot make a previously in-scope ujian become out-of-scope
  // because we are not mutating the ujian in place; the predicate is
  // checked on the read path only.)

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
      toast.error("Buat topik dulu");
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
      toast.error("Nama wajib");
      return;
    }
    // Validasi server-side: pastikan semua topicSet masih dalam scope.
    // Client-side guard di sini hanya untuk UX; authorizeMutation di server
    // adalah pagar terakhir (lihat operatorCanTouchTopicSets).
    if (allowedSet) {
      const outOfScope = u!.topicSets.filter((ts) => !allowedSet.has(ts.topikId));
      if (outOfScope.length > 0) {
        toast.error("Ada topic set di luar topik yang diizinkan");
        return;
      }
    }
    ujianRepo.upsert(u!);
    await ujianRepo.flush();
    toast.success("Disimpan");
    navigate({ to: "/admin/ujian" });
  }

  async function hapus() {
    if (!confirm(`Yakin ingin menghapus ujian "${u!.nama}" beserta seluruh data yang terkait?`)) return;
    ujianRepo.remove(u!.id);
    await ujianRepo.flush();
    toast.success("Ujian dihapus");
    navigate({ to: "/admin/ujian" });
  }

  return (
    <div className="space-y-6 w-full max-w-[1600px] mx-auto pb-12">
      {/* Top Header */}
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

      {/* Main Grid Layout (Left: Main Content, Right: Configuration Sidebar) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

        {/* LEFT COLUMN: Main Settings & Soal (7 cols) */}
        <div className="xl:col-span-7 space-y-6">

          {/* Card 1: Informasi Utama */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <CardHeader className="bg-slate-50/60 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-800 py-3.5">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <FileText className="h-4 w-4 text-primary" />
                Informasi Utama Ujian
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Nama Ujian</Label>
                  <Input value={u.nama} onChange={(e) => set("nama", e.target.value)} placeholder="Misal: Ujian Akhir Semester" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Durasi (Menit)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={u.durasiMenit}
                    onChange={(e) => set("durasiMenit", Number(e.target.value))}
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Mata Kuliah (Opsional)</Label>
                  <Select value={u.mataKuliahId || "none"} onValueChange={(v) => set("mataKuliahId", v === "none" ? undefined : v)}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Pilih Mata Kuliah" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">(Tanpa Mata Kuliah)</SelectItem>
                      {mkList.map((mk) => (
                        <SelectItem key={mk.id} value={mk.id}>{mk.nama}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Semester (Opsional)</Label>
                  <Select value={u.semesterId || "none"} onValueChange={(v) => set("semesterId", v === "none" ? undefined : v)}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Pilih Semester" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">(Tanpa Semester)</SelectItem>
                      {smtList.map((smt) => (
                        <SelectItem key={smt.id} value={smt.id}>{smt.nama}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Deskripsi / Petunjuk Ujian</Label>
                <RichEditor value={u.deskripsi} onChange={(v) => set("deskripsi", v)} minHeight={100} />
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Topic Set (Sumber Soal) */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <CardHeader className="bg-slate-50/60 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-800 py-3.5 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <Layers className="h-4 w-4 text-primary" />
                Topic Set (Sumber Soal Ujian)
              </CardTitle>
              <Button size="sm" variant="outline" onClick={addTopicSet} className="h-8 text-xs">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Tambah Topic Set
              </Button>
            </CardHeader>
            <CardContent className="p-5 space-y-3">
              {u.topicSets.map((ts, i) => {
                const t = topiks.find((tk) => tk.id === ts.topikId);
                const m = t ? moduls.find((mm) => mm.id === t.modulId) : null;
                const inScope = isTopikAllowed(user, ts.topikId);
                return (
                  <div key={ts.id} className="rounded-xl border border-slate-200/80 dark:border-slate-800 p-4 space-y-3 bg-white dark:bg-slate-950 shadow-2xs">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                      <div className="sm:col-span-6 space-y-1">
                        <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">Pilih Topik Soal</Label>
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
                                <SelectItem key={tk.id} value={tk.id}>
                                  {isMatchMk ? "★ " : ""} {mm?.nama} — {tk.nama}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="sm:col-span-2 space-y-1">
                        <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">Jumlah Soal</Label>
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
                          className="h-9 text-xs"
                        />
                      </div>
                      <div className="sm:col-span-4 flex items-center justify-start gap-4 pb-2">
                        <div className="flex items-center gap-1.5">
                          <Checkbox
                            id={`acakSoal-${ts.id}`}
                            checked={ts.acakSoal}
                            onCheckedChange={(v) =>
                              set(
                                "topicSets",
                                u.topicSets.map((x, idx) => (idx === i ? { ...x, acakSoal: !!v } : x)),
                              )
                            }
                          />
                          <Label htmlFor={`acakSoal-${ts.id}`} className="text-xs cursor-pointer">Acak Soal</Label>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Checkbox
                            id={`acakJawaban-${ts.id}`}
                            checked={ts.acakJawaban}
                            onCheckedChange={(v) =>
                              set(
                                "topicSets",
                                u.topicSets.map((x, idx) => (idx === i ? { ...x, acakJawaban: !!v } : x)),
                              )
                            }
                          />
                          <Label htmlFor={`acakJawaban-${ts.id}`} className="text-xs cursor-pointer">Acak Opsi</Label>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                      <span className="font-medium">
                        {m?.nama} → {t?.nama}
                        {!inScope && (
                          <span className="ml-2 rounded bg-destructive/10 border border-destructive/20 px-2 py-0.5 text-[10px] font-bold text-destructive">
                            di luar scope
                          </span>
                        )}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-slate-400 hover:text-destructive hover:bg-destructive/10"
                        onClick={() =>
                          set(
                            "topicSets",
                            u.topicSets.filter((_, idx) => idx !== i),
                          )
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Hapus
                      </Button>
                    </div>
                  </div>
                );
              })}
              {u.topicSets.length === 0 && (
                <div className="flex flex-col items-center justify-center py-6 px-4 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20">
                  <Layers className="h-8 w-8 text-slate-400 mb-2 opacity-50" />
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Belum ada topik soal (Topic Set).</p>
                  <p className="text-xs text-slate-500 mt-1">Silakan klik "Tambah Topic Set" untuk mengambil soal dari bank soal.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card 3: Kelola Token Ujian */}
          <TokenManager ujian={u} />
        </div>

        {/* RIGHT COLUMN: Sidebar Configurations (5 cols) */}
        <div className="xl:col-span-5 space-y-6">

          {/* Card: Skoring & Poin */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <CardHeader className="bg-slate-50/60 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-800 py-3.5">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <Award className="h-4 w-4 text-primary" />
                Aturan Skoring & Poin
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Poin Benar</Label>
                  <Input
                    type="number"
                    value={u.poinBenar}
                    onChange={(e) => set("poinBenar", Number(e.target.value))}
                    className="h-9 text-sm font-semibold"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Poin Salah</Label>
                  <Input
                    type="number"
                    value={u.poinSalah}
                    onChange={(e) => set("poinSalah", Number(e.target.value))}
                    className="h-9 text-sm font-semibold"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Poin Kosong</Label>
                  <Input
                    type="number"
                    value={u.poinKosong}
                    onChange={(e) => set("poinKosong", Number(e.target.value))}
                    className="h-9 text-sm font-semibold"
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                * Poin salah bisa diisi nilai negatif (contoh: <code>-1</code>) untuk menerapkan sistem penalti poin.
              </p>
            </CardContent>
          </Card>

          {/* Card: Akses & Group Peserta */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <CardHeader className="bg-slate-50/60 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-800 py-3.5">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <Users className="h-4 w-4 text-primary" />
                Akses & Otorisasi Peserta
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Group / Angkatan yang Diizinkan (Kosong = Terbuka Semua)</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[160px] overflow-auto p-1">
                  {groups.map((g) => (
                    <label key={g.id} className="flex items-center gap-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800 p-2.5 text-xs font-medium cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
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
              </div>

              <div className="flex items-center justify-between rounded-xl border border-slate-200/80 dark:border-slate-800 p-3.5 bg-slate-50/50 dark:bg-slate-900/50">
                <div>
                  <Label className="text-xs font-semibold">Wajib Input Token Ujian</Label>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Peserta harus memasukkan kode token sebelum mulai ujian
                  </p>
                </div>
                <Switch checked={u.tokenAktif} onCheckedChange={(v) => set("tokenAktif", v)} />
              </div>
            </CardContent>
          </Card>

          {/* Card: Alat Bantu Ujian */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <CardHeader className="bg-slate-50/60 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-800 py-3.5">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <Wrench className="h-4 w-4 text-primary" />
                Alat Bantu Ujian Peserta
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-slate-200/80 dark:border-slate-800 p-3.5">
                <div>
                  <Label htmlFor="allow-calculator" className="text-xs font-semibold cursor-pointer">Kalkulator Ilmiah Ujian</Label>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Izinkan peserta membuka widget kalkulator di layar ujian
                  </p>
                </div>
                <Switch
                  id="allow-calculator"
                  checked={u.allowCalculator ?? false}
                  onCheckedChange={(value) => set("allowCalculator", value)}
                />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200/80 dark:border-slate-800 p-3.5">
                <div>
                  <Label htmlFor="allow-nilai-normal" className="text-xs font-semibold cursor-pointer">Referensi Nilai Normal Lab</Label>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Tampilkan tombol referensi tabel medis/laboratorium
                  </p>
                </div>
                <Switch
                  id="allow-nilai-normal"
                  checked={u.allowNilaiNormal ?? false}
                  onCheckedChange={(value) => set("allowNilaiNormal", value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Card: Keamanan & Tampilan Hasil */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <CardHeader className="bg-slate-50/60 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-800 py-3.5">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <ShieldAlert className="h-4 w-4 text-primary" />
                Keamanan & Tampilan Hasil
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-slate-200/80 dark:border-slate-800 p-3 text-xs">
                <Label className="font-medium cursor-pointer">Tampilkan skor setelah submit</Label>
                <Switch checked={u.showResult} onCheckedChange={(v) => set("showResult", v)} />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200/80 dark:border-slate-800 p-3 text-xs">
                <Label className="font-medium cursor-pointer">Tampilkan pembahasan & detail jawaban</Label>
                <Switch
                  checked={u.showResultDetail}
                  onCheckedChange={(v) => set("showResultDetail", v)}
                />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200/80 dark:border-slate-800 p-3 text-xs">
                <Label className="font-medium cursor-pointer">Wajib Layar Penuh (Fullscreen)</Label>
                <Switch
                  checked={u.fullscreenWajib}
                  onCheckedChange={(v) => set("fullscreenWajib", v)}
                />
              </div>
              <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Toleransi Pindah Tab (Sebelum Auto-Submit)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={u.maxPindahTab}
                    onChange={(e) => set("maxPindahTab", Number(e.target.value))}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <Label htmlFor="blokir-shortcut" className="text-xs cursor-pointer">Blokir Copy/Paste & Klik Kanan</Label>
                  <Switch
                    id="blokir-shortcut"
                    checked={u.blokirShortcut}
                    onCheckedChange={(v) => set("blokirShortcut", v)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

        </div>

      </div>
    </div>
  );
}
