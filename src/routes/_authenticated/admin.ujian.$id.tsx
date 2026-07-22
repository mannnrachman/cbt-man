import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ujianRepo, unitAkademikRepo, hydrateRepos, mataKuliahRepo, semesterRepo } from "@/lib/cbt/repos";
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
import { Plus, Trash2, Save, Lock } from "lucide-react";
import { toast } from "sonner";
import { RichEditor } from "@/components/cbt/RichEditor";
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

function UjianEditor() {
  const { id } = useParams({ from: "/_authenticated/admin/ujian/$id" });
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

  function save() {
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
    toast.success("Disimpan");
    navigate({ to: "/admin/ujian" });
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/admin/ujian" className="text-sm text-muted-foreground hover:underline">
            ← Paket ujian
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Editor Ujian</h1>
        </div>
        <Button onClick={save}>
          <Save className="mr-1 h-4 w-4" />
          Simpan
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nama</Label>
              <Input value={u.nama} onChange={(e) => set("nama", e.target.value)} />
            </div>
            <div>
              <Label>Durasi (menit)</Label>
              <Input
                type="number"
                min={1}
                value={u.durasiMenit}
                onChange={(e) => set("durasiMenit", Number(e.target.value))}
              />
            </div>
          </div>
          <div>
            <Label>Deskripsi / instruksi</Label>
            <RichEditor value={u.deskripsi} onChange={(v) => set("deskripsi", v)} minHeight={80} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Mata Kuliah (Opsional)</Label>
              <Select value={u.mataKuliahId || "none"} onValueChange={(v) => set("mataKuliahId", v === "none" ? undefined : v)}>
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
              <Label>Semester (Opsional)</Label>
              <Select value={u.semesterId || "none"} onValueChange={(v) => set("semesterId", v === "none" ? undefined : v)}>
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
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="font-medium">Skoring</h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Poin benar</Label>
              <Input
                type="number"
                value={u.poinBenar}
                onChange={(e) => set("poinBenar", Number(e.target.value))}
              />
            </div>
            <div>
              <Label>Poin salah</Label>
              <Input
                type="number"
                value={u.poinSalah}
                onChange={(e) => set("poinSalah", Number(e.target.value))}
              />
            </div>
            <div>
              <Label>Poin kosong</Label>
              <Input
                type="number"
                value={u.poinKosong}
                onChange={(e) => set("poinKosong", Number(e.target.value))}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Poin salah boleh negatif untuk negative marking.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Topic Set (sumber soal)</h3>
            <Button size="sm" variant="outline" onClick={addTopicSet}>
              <Plus className="mr-1 h-4 w-4" />
              Tambah
            </Button>
          </div>
          {u.topicSets.map((ts, i) => {
            const t = topiks.find((tk) => tk.id === ts.topikId);
            const m = t ? moduls.find((mm) => mm.id === t.modulId) : null;
            const inScope = isTopikAllowed(user, ts.topikId);
            return (
              <div key={ts.id} className="rounded border p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <div className="col-span-2">
                    <Label className="text-xs">Topik</Label>
                    <Select
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
                  <div>
                    <Label className="text-xs">Jumlah</Label>
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
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-5">
                    <Checkbox
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
                  <div className="flex items-center gap-2 pt-5">
                    <Checkbox
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
            <p className="text-sm text-muted-foreground">Belum ada topic set.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="font-medium">Akses peserta</h3>
          <div className="space-y-1">
            <Label className="text-xs">Group yang boleh ikut (kosong = semua)</Label>
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
        <CardContent className="p-4 space-y-3">
          <h3 className="font-medium">Tampilan hasil & anti-cheat</h3>
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
      </Card>
    </div>
  );
}
