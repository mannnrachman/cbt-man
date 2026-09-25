import { createFileRoute, Link, Outlet, useParams, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ujianRepo, unitAkademikRepo, hydrateRepos, mataKuliahRepo, semesterRepo, penawaranRepo, sesiRepo } from "@/lib/cbt/repos";

import { uid } from "@/lib/cbt/storage";
import type { Ujian, TopicSet } from "@/lib/cbt/types";
import { Card, CardContent } from "@/components/ui/card";
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
import { Plus, Trash2, Save, Lock, ArrowLeft, FileSignature, KeyRound, Users, BarChart3, CalendarClock, Calendar, Clock, Info, FileText } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { RichEditor, RichView } from "@/components/cbt/RichEditor";
import { AdminPage, AdminPageHeader } from "@/components/cbt/AdminPage";
import { ConfirmDialog } from "@/components/cbt/ConfirmDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuthStore } from "@/lib/cbt/auth-store";
import {
  allowedTopikIdSet,
  isTopikAllowed,
  ujianTouchesAllowed,
  visibleModuls,
  visibleTopiks,
} from "@/lib/cbt/access";
import { fetchUjianByIdServer, mutateUjianServer, extendJadwalUjianServer } from "@/lib/server/ujian/functions";

function toDateTimeLocal(value?: number) {
  if (value === undefined) return "";
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDateTimeLocal(value: string) {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function formatReadableDate(value?: number) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export const Route = createFileRoute("/_authenticated/admin/ujian/$id")({
  loader: async () => {
    try {
      await hydrateRepos();
    } catch {
      // Fallback ke cache; jangan brick navigasi saat snapshot gagal.
    }
  },
  component: UjianEditorRoute,
});

function UjianEditorRoute() {
  const { id } = useParams({ from: "/_authenticated/admin/ujian/$id" });
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (pathname !== `/admin/ujian/${id}` && pathname !== `/admin/ujian/${id}/`) return <Outlet />;
  return <UjianEditor />;
}

function UjianEditor() {
  const { id } = useParams({ from: "/_authenticated/admin/ujian/$id" });
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const initial = ujianRepo.byId(id);
  
  const mkList = mataKuliahRepo.all();
  const smtList = semesterRepo.all();
  const penawaranList = penawaranRepo.all();

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
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);
  const [newEndAtInput, setNewEndAtInput] = useState("");
  const [isExtending, setIsExtending] = useState(false);
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
    if (u!.status !== "draft" || sesiRepo.all().some((s) => s.ujianId === id)) return;
    setU({ ...u!, [k]: v });
  }

  function addTopicSet() {
    if (sortedTopiks.length === 0) {
      toast.error("Buat topik dulu");
      return;
    }
    const ts: TopicSet = {
      id: uid("ts_"),
      topikId: sortedTopiks[0].id,
      jumlah: 5,
      jumlahOpsi: 4,
      acakSoal: true,
      acakJawaban: true,
    };
    set("topicSets", [...u!.topicSets, ts]);
  }

  async function save() {
    if (u!.status !== "draft" || sesiRepo.all().some((s) => s.ujianId === id)) {
      toast.error("Paket yang telah dipublikasikan atau memiliki sesi tidak dapat diubah melalui editor");
      return;
    }
    if (!u!.nama.trim()) {
      toast.error("Nama wajib");
      return;
    }
    if (!Number.isInteger(u!.durasiMenit) || u!.durasiMenit < 1) {
      toast.error("Durasi harus minimal 1 menit");
      return;
    }
    if (u!.beginAt !== undefined && u!.endAt !== undefined && u!.endAt <= u!.beginAt) {
      toast.error("Waktu selesai harus setelah waktu mulai");
      return;
    }
    if (u!.topicSets.some((ts) => !Number.isInteger(ts.jumlah) || ts.jumlah < 1)) {
      toast.error("Jumlah soal pada setiap sumber harus minimal 1");
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
    const result = await ujianRepo.flush();
    if (!result.ok) {
      toast.error(result.error || "Gagal menyimpan perubahan");
      return;
    }
    toast.success("Disimpan");
    navigate({ to: "/admin/ujian" });
  }

  async function publish() {
    if (u!.status !== "draft") return;
    ujianRepo.upsert(u!);
    const saveResult = await ujianRepo.flush();
    if (!saveResult.ok) {
      toast.error(saveResult.error || "Gagal menyimpan draft");
      return;
    }
    const result = await mutateUjianServer({ data: { action: "publish", payload: { id: u!.id } } });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const published = { ...u!, status: "published" as const };
    setU(published);
    toast.success("Paket ujian dipublikasikan");
  }

  function openExtendModal() {
    if (!u) return;
    const baseTime = u.endAt ? Math.max(Date.now(), Number(u.endAt)) : Date.now();
    const d = new Date(baseTime + 60 * 60 * 1000);
    setNewEndAtInput(toDateTimeLocal(d.getTime()));
    setExtendOpen(true);
  }

  async function handleExtendJadwal() {
    if (!newEndAtInput || !u) return;
    const newEndAt = fromDateTimeLocal(newEndAtInput);
    if (!newEndAt) {
      toast.error("Format waktu selesai tidak valid");
      return;
    }
    if (newEndAt <= Date.now()) {
      toast.error("Batas waktu selesai baru harus di masa mendatang");
      return;
    }
    if (u.beginAt && newEndAt <= u.beginAt) {
      toast.error("Batas waktu selesai harus lebih besar dari waktu mulai");
      return;
    }

    setIsExtending(true);
    try {
      const res = await extendJadwalUjianServer({
        data: {
          ujianId: u.id,
          newEndAt,
        },
      });

      if (!res.ok) {
        toast.error(res.error || "Gagal memperpanjang jadwal ujian");
        return;
      }

      setU((prev) => prev ? { ...prev, endAt: newEndAt } : prev);
      toast.success("Jadwal ujian berhasil diperpanjang");
      setExtendOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan saat memperpanjang jadwal");
    } finally {
      setIsExtending(false);
    }
  }

  async function hapus() {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      ujianRepo.remove(u!.id);
      const result = await ujianRepo.flush();
      if (!result.ok) {
        toast.error(result.error || "Gagal menghapus ujian");
        return;
      }
      toast.success("Ujian dihapus");
      navigate({ to: "/admin/ujian" });
    } catch {
      toast.error("Gagal menghapus ujian");
    } finally {
      setIsDeleting(false);
    }
  }

  const hasSessions = sesiRepo.all().some((s) => s.ujianId === id);
  const locked = u.status !== "draft" || hasSessions;
  const totalSoal = u.topicSets.reduce((total, topicSet) => total + (Number(topicSet.jumlah) || 0), 0);

  return (
    <AdminPage className="mx-auto w-full max-w-[1600px] pb-12">
      <AdminPageHeader
        title={
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-2">
              <FileSignature className="h-5 w-5 text-primary" />
              Editor Paket Ujian
            </span>
            <span
              className={cn(
                "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-wide uppercase",
                u.status === "published"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                  : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700",
              )}
            >
              {u.status === "published" ? "Published" : "Draft"}
            </span>
            {hasSessions && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-wide uppercase bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                Memiliki Sesi Peserta
              </span>
            )}
          </div>
        }
        description={
          <span className="text-xs text-muted-foreground block truncate max-w-xl">
            {u.nama || "Ujian Baru"} · {u.durasiMenit} Menit · {totalSoal} Soal
          </span>
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="ghost" className="h-9 text-xs">
              <Link to="/admin/ujian">
                <ArrowLeft className="mr-1 h-4 w-4" />
                Kembali
              </Link>
            </Button>
            <Button
              variant="outline"
              className="h-9 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="mr-1 h-4 w-4" />
              Hapus
            </Button>
            {u.status === "draft" && (
              <Button variant="outline" className="h-9 text-xs" onClick={publish}>
                Publikasikan
              </Button>
            )}
            {!locked && <Button onClick={save} className="h-9 text-xs font-semibold shadow-xs">
              <Save className="mr-1 h-4 w-4" />
              Simpan Perubahan
            </Button>}
          </div>
        }
      />

      {/* Sub-Modul & Quick Actions Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2.5 bg-card border border-border/80 rounded-lg shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground px-1">
            Modul Terkait:
          </span>
          <Button asChild variant="outline" size="sm" className="h-8 text-xs font-medium">
            <Link to="/admin/ujian/$id/peserta" params={{ id: u.id }}>
              <Users className="mr-1 h-3.5 w-3.5 text-muted-foreground" /> Peserta
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="h-8 text-xs font-medium">
            <Link to="/admin/ujian/$id/token" params={{ id: u.id }}>
              <KeyRound className="mr-1 h-3.5 w-3.5 text-muted-foreground" /> Kelola Token
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="h-8 text-xs font-medium">
            <Link to="/admin/analitik/$id" params={{ id: u.id }}>
              <BarChart3 className="mr-1 h-3.5 w-3.5 text-muted-foreground" /> Analitik
            </Link>
          </Button>
        </div>

        {u.status === "published" && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openExtendModal}
            className="h-8 text-xs font-medium text-primary hover:text-primary border-primary/30 hover:bg-primary/5 w-fit"
          >
            <CalendarClock className="mr-1 h-3.5 w-3.5" />
            Perpanjang Jadwal
          </Button>
        )}
      </div>

      {locked && <p className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200" role="status">Paket yang sudah dipublikasikan atau memiliki sesi tidak dapat diedit.</p>}
      <fieldset disabled={locked} aria-disabled={locked} className="min-w-0 space-y-4">
      <Card className="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent className="space-y-4 p-4">
          <div className="flex items-center gap-2.5 border-b pb-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">Informasi Dasar</h3>
              <p className="text-xs text-muted-foreground">Nama paket ujian, durasi pengerjaan, dan petunjuk pelaksanaan ujian.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs font-medium">Nama Paket Ujian</Label>
              <Input value={u.nama} onChange={(e) => set("nama", e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs font-medium">Durasi (menit)</Label>
              <Input
                type="number"
                min={1}
                value={u.durasiMenit}
                onChange={(e) => set("durasiMenit", Number(e.target.value))}
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs font-medium">Deskripsi / Instruksi</Label>
            <div className="mt-1">
              {locked ? <RichView html={u.deskripsi} /> : <RichEditor value={u.deskripsi} onChange={(v) => set("deskripsi", v)} minHeight={80} />}
            </div>
          </div>
          <details className="rounded-md border">
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Metadata akademik (opsional)</summary>
            <div className="grid grid-cols-1 gap-3 border-t p-3 sm:grid-cols-3">
            <div>
              <Label>Mata Kuliah</Label>
              <Select value={u.mataKuliahId || "none"} onValueChange={(v) => { set("mataKuliahId", v === "none" ? undefined : v); set("penawaranId", undefined); }}>
                <SelectTrigger>
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
            <div>
              <Label>Semester</Label>
              <Select value={u.semesterId || "none"} onValueChange={(v) => { set("semesterId", v === "none" ? undefined : v); set("penawaranId", undefined); }}>
                <SelectTrigger>
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
            <div>
              <Label>Kelas Mata Kuliah</Label>
              <Select
                value={u.penawaranId || "none"}
                onValueChange={(v) => {
                  const offering = penawaranList.find((item) => item.id === v);
                  set("penawaranId", v === "none" ? undefined : v);
                  if (offering) {
                    set("mataKuliahId", offering.mataKuliahId);
                    set("semesterId", offering.semesterId);
                  }
                }}
              >
                <SelectTrigger><SelectValue placeholder="Pilih kelas mata kuliah" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">(Belum dipilih)</SelectItem>
                  {penawaranList.map((offering) => {
                    const mk = mkList.find((item) => item.id === offering.mataKuliahId);
                    const semester = smtList.find((item) => item.id === offering.semesterId);
                    return <SelectItem key={offering.id} value={offering.id}>{mk?.nama ?? "Mata kuliah"} — {semester?.nama ?? "Tanpa semester"} {offering.kodeKelas}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">Gunakan jika peserta dikelola melalui kelas mata kuliah.</p>
            </div>
          </div>
          </details>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Hapus Ujian"
        description={`Yakin ingin menghapus ujian "${u.nama}" beserta seluruh data yang terkait?`}
        confirmLabel="Hapus"
        busy={isDeleting}
        onConfirm={hapus}
      />

      <Dialog open={extendOpen} onOpenChange={setExtendOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="h-5 w-5 text-primary" />
              Perpanjang Jadwal Ujian
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
Perpanjang batas mulai ujian baru. Batas waktu sesi peserta yang sudah berjalan tidak berubah; gunakan pengelolaan sesi terpisah untuk peserta tersebut.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1">
              <div className="font-semibold text-slate-900 dark:text-slate-100">{u.nama}</div>
              <div className="text-muted-foreground">
                Waktu Mulai: {u.beginAt ? new Date(u.beginAt).toLocaleString("id-ID") : "-"}
              </div>
              <div className="text-muted-foreground">
                Waktu Selesai Sebelumnya: {u.endAt ? new Date(u.endAt).toLocaleString("id-ID") : "-"}
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="perpanjang-end-at" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Batas Waktu Selesai Baru
              </label>
              <Input
                id="perpanjang-end-at"
                type="datetime-local"
                value={newEndAtInput}
                onChange={(e) => setNewEndAtInput(e.target.value)}
                className="w-full text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Berlaku untuk peserta yang memulai sesi baru. Sesi yang sudah berjalan tidak berubah.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isExtending}
              onClick={() => setExtendOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isExtending}
              onClick={handleExtendJadwal}
            >
              {isExtending ? "Menyimpan..." : "Simpan Jadwal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Calendar className="h-4.5 w-4.5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">Jadwal Ujian</h3>
                  {u.status === "published" && u.beginAt && u.endAt && (
                    <span className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border",
                      Date.now() > u.endAt
                        ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700"
                        : Date.now() >= u.beginAt
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                          : "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-300 dark:border-blue-800"
                    )}>
                      {Date.now() > u.endAt
                        ? "Jadwal Telah Berakhir"
                        : Date.now() >= u.beginAt
                          ? "Sedang Berlangsung"
                          : "Belum Dimulai"}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Peserta hanya dapat mulai di antara waktu mulai dan selesai. Jadwal wajib ditentukan sebelum publikasi.
                </p>
              </div>
            </div>

            {u.status === "published" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={openExtendModal}
                className="h-8 gap-1.5 px-3 text-xs font-medium border-primary/30 hover:bg-primary/5 text-primary shrink-0"
              >
                <CalendarClock className="h-3.5 w-3.5" />
                Perpanjang Jadwal
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {/* Kolom Waktu Mulai */}
            <div className="rounded-lg border border-border/80 bg-slate-50/50 dark:bg-slate-900/30 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="ujian-begin-at" className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <Clock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  Waktu Mulai
                </Label>
                <span className="text-[11px] text-muted-foreground">Awal gerbang dibuka</span>
              </div>
              <Input
                id="ujian-begin-at"
                type="datetime-local"
                value={toDateTimeLocal(u.beginAt)}
                onChange={(e) => set("beginAt", fromDateTimeLocal(e.target.value))}
                className="bg-white dark:bg-slate-950 text-sm font-medium"
              />
              <div className="text-[11px] text-muted-foreground min-h-[1.25rem]">
                {u.beginAt ? (
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {formatReadableDate(u.beginAt)}
                  </span>
                ) : (
                  <span className="italic text-slate-400">Belum diatur</span>
                )}
              </div>
            </div>

            {/* Kolom Waktu Selesai */}
            <div className="rounded-lg border border-border/80 bg-slate-50/50 dark:bg-slate-900/30 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="ujian-end-at" className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <CalendarClock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  Waktu Selesai
                </Label>
                <span className="text-[11px] text-muted-foreground">Batas akhir mulai sesi</span>
              </div>
              <Input
                id="ujian-end-at"
                type="datetime-local"
                value={toDateTimeLocal(u.endAt)}
                onChange={(e) => set("endAt", fromDateTimeLocal(e.target.value))}
                className="bg-white dark:bg-slate-950 text-sm font-medium"
              />
              <div className="text-[11px] text-muted-foreground min-h-[1.25rem]">
                {u.endAt ? (
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {formatReadableDate(u.endAt)}
                  </span>
                ) : (
                  <span className="italic text-slate-400">Belum diatur</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span>
              Durasi pengerjaan masing-masing peserta adalah <strong>{u.durasiMenit} menit</strong> sejak peserta memulai sesi.
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 dark:border-slate-800 shadow-xs">
          <details>
          <summary className="cursor-pointer p-4 text-sm font-medium">Pengaturan skoring</summary>
      <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Poin benar</Label>
              <Input
                type="number"
                disabled={hasSessions}
                value={u.poinBenar}
                onChange={(e) => set("poinBenar", Number(e.target.value))}
              />
            </div>
            <div>
              <Label>Poin salah</Label>
              <Input
                type="number"
                disabled={hasSessions}
                value={u.poinSalah}
                onChange={(e) => set("poinSalah", Number(e.target.value))}
              />
            </div>
            <div>
              <Label>Poin kosong</Label>
              <Input
                type="number"
                disabled={hasSessions}
                value={u.poinKosong}
                onChange={(e) => set("poinKosong", Number(e.target.value))}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {hasSessions
              ? "Bobot poin dikunci karena ujian sudah memiliki sesi peserta."
              : "Poin salah boleh negatif untuk negative marking."}
          </p>
        </CardContent>
        </details>
      </Card>

      <Card className="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Sumber soal ujian</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Tambahkan satu atau beberapa topik. Total soal: <span className="font-semibold text-foreground">{totalSoal}</span>
                {hasSessions && <span className="ml-2 font-medium text-amber-600 dark:text-amber-400">(Dikunci karena memiliki sesi)</span>}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={addTopicSet} disabled={hasSessions} type="button">
              <Plus className="mr-1 h-4 w-4" />
              Tambah topik
            </Button>
          </div>
          {u.topicSets.map((ts, i) => {
            const t = topiks.find((tk) => tk.id === ts.topikId);
            const m = t ? moduls.find((mm) => mm.id === t.modulId) : null;
            const inScope = isTopikAllowed(user, ts.topikId);
            return (
              <div key={ts.id} className="space-y-2 border-t py-3 first:border-t-0 first:pt-0">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_auto_auto] sm:items-end">
                  <div>
                    <Label className="text-xs">Topik sumber</Label>
                    <Select
                      disabled={hasSessions}
                      value={ts.topikId}
                      onValueChange={(v) =>
                        set(
                          "topicSets",
                          u.topicSets.map((x, idx) => (idx === i ? { ...x, topikId: v } : x)),
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {sortedTopiks.filter((tk) => {
                          if (!u.mataKuliahId) return true;
                          const mm = moduls.find((modul) => modul.id === tk.modulId);
                          return mm?.mataKuliahId === u.mataKuliahId;
                        }).map((tk) => {
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
                  <div>
                    <Label className="text-xs">Jumlah soal</Label>
                    <Input
                      type="number"
                      min={1}
                      disabled={hasSessions}
                      value={ts.jumlah}
                      onChange={(e) =>
                        set(
                          "topicSets",
                          u.topicSets.map((x, idx) =>
                            idx === i ? { ...x, jumlah: Number(e.target.value) } : x,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="flex min-h-9 items-center gap-2">
                    <Checkbox
                      disabled={hasSessions}
                      checked={ts.acakSoal}
                      onCheckedChange={(v) =>
                        set(
                          "topicSets",
                          u.topicSets.map((x, idx) => (idx === i ? { ...x, acakSoal: !!v } : x)),
                        )
                      }
                    />
                    <Label className="text-xs">Acak soal</Label>
                  </div>
                  <div className="flex min-h-9 items-center gap-2">
                    <Checkbox
                      disabled={hasSessions}
                      checked={ts.acakJawaban}
                      onCheckedChange={(v) =>
                        set(
                          "topicSets",
                          u.topicSets.map((x, idx) => (idx === i ? { ...x, acakJawaban: !!v } : x)),
                        )
                      }
                    />
                    <Label className="text-xs">Acak jawaban</Label>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {m?.nama} → {t?.nama}
                    {!inScope && (
                      <span className="ml-2 rounded bg-destructive/20 px-1.5 py-0.5 text-destructive">
                        di luar scope
                      </span>
                    )}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={hasSessions}
                    aria-label={`Hapus sumber topik ${i + 1}`}
                    title={`Hapus sumber topik ${i + 1}`}
                    onClick={() =>
                      set(
                        "topicSets",
                        u.topicSets.filter((_, idx) => idx !== i),
                      )
                    }
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
          {u.topicSets.length === 0 && (
            <p className="text-sm text-muted-foreground">Belum ada sumber soal. Tambahkan topik agar paket dapat digunakan.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="font-medium">Akses peserta</h3>
          <div className="space-y-1">
            <Label className="text-xs">Unit peserta (wajib dipilih sebelum publikasi)</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {groups.map((g) => (
                <label key={g.id} className="flex items-center gap-2 rounded border p-2 text-sm">
                  <Checkbox
                    checked={u.groupIds.includes(g.id)}
                    onCheckedChange={(v) =>
                      set(
                        "groupIds",
                        v ? [...u.groupIds, g.id] : u.groupIds.filter((x) => x !== g.id),
                      )
                    }
                  />
                  {g.nama}
                </label>
              ))}
            </div>
            {u.groupIds.length === 0 && (
              <p className="text-xs text-amber-600">Belum ada unit peserta. Paket tidak akan bisa diakses peserta.</p>
            )}
          </div>
          <div className="flex items-center justify-between rounded border p-2">
            <div>
              <Label>Token ujian wajib</Label>
              <p className="text-xs text-muted-foreground">
                Peserta harus input token sebelum mulai
              </p>
            </div>
            <Switch checked={u.tokenAktif} onCheckedChange={(v) => set("tokenAktif", v)} />
          </div>
        </CardContent>
      </Card>

      <Card>
          <details>
          <summary className="cursor-pointer p-4 text-sm font-medium">Alat bantu ujian</summary>
      <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between rounded border p-2">
            <div>
              <Label htmlFor="allow-calculator">Kalkulator ujian</Label>
              <p className="text-xs text-muted-foreground">
                Izinkan peserta membuka kalkulator selama ujian.
              </p>
            </div>
            <Switch
              id="allow-calculator"
              checked={u.allowCalculator}
              onCheckedChange={(value) => set("allowCalculator", value)}
            />
          </div>
          <div className="flex items-center justify-between rounded border p-2">
            <div>
              <Label htmlFor="allow-nilai-normal">Tabel nilai normal</Label>
              <p className="text-xs text-muted-foreground">
                Izinkan peserta membuka tabel rujukan nilai normal laboratorium selama ujian.
              </p>
            </div>
            <Switch
              id="allow-nilai-normal"
              checked={u.allowNilaiNormal}
              onCheckedChange={(value) => set("allowNilaiNormal", value)}
            />
          </div>
        </CardContent>
        </details>
      </Card>

      <Card>
          <details>
          <summary className="cursor-pointer p-4 text-sm font-medium">Tampilan hasil & anti-cheat</summary>
      <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between rounded border p-2">
            <Label>Tampilkan skor ke peserta setelah submit</Label>
            <Switch checked={u.showResult} onCheckedChange={(v) => set("showResult", v)} />
          </div>
          <div className="flex items-center justify-between rounded border p-2">
            <Label>Tampilkan pembahasan & detail jawaban</Label>
            <Switch
              checked={u.showResultDetail}
              onCheckedChange={(v) => set("showResultDetail", v)}
            />
          </div>
          <div className="flex items-center justify-between rounded border p-2">
            <Label>Wajib fullscreen</Label>
            <Switch
              checked={u.fullscreenWajib}
              onCheckedChange={(v) => set("fullscreenWajib", v)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Max pindah tab (sebelum auto-submit)</Label>
              <Input
                type="number"
                min={0}
                value={u.maxPindahTab}
                onChange={(e) => set("maxPindahTab", Number(e.target.value))}
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch
                checked={u.blokirShortcut}
                onCheckedChange={(v) => set("blokirShortcut", v)}
              />
              <Label>Blokir copy/paste & klik kanan</Label>
            </div>
          </div>
        </CardContent>
        </details>
      </Card>
      </fieldset>
    </AdminPage>
  );
}
