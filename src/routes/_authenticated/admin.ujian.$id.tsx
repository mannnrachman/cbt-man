import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ujianRepo, topikRepo, groupsRepo, modulRepo, hydrateRepos } from "@/lib/cbt/repos";
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
import { Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import { RichEditor } from "@/components/cbt/RichEditor";

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
  const initial = ujianRepo.byId(id);
  const [u, setU] = useState<Ujian | null>(initial ?? null);
  const groups = groupsRepo.all();
  const topiks = topikRepo.all();
  const moduls = modulRepo.all();

  if (!u)
    return (
      <div>
        Ujian tidak ditemukan.{" "}
        <Link to="/admin/ujian" className="text-primary">
          Kembali
        </Link>
      </div>
    );

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
            const t = topikRepo.byId(ts.topikId);
            const m = t ? modulRepo.byId(t.modulId) : null;
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
                        {topiks.map((tk) => {
                          const mm = moduls.find((mm) => mm.id === tk.modulId);
                          return (
                            <SelectItem key={tk.id} value={tk.id}>
                              {mm?.nama} — {tk.nama}
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
