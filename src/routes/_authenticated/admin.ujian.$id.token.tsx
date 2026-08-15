import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ujianRepo, tokenRepo, usersRepo } from "@/lib/cbt/repos";
import { fetchUjianByIdServer, generateExamTokensServer, deleteExamTokenServer } from "@/lib/server/ujian/functions";
import type { TokenUjian, Ujian } from "@/lib/cbt/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Copy, Lock, KeyRound, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/cbt/auth-store";
import { ujianTouchesAllowed } from "@/lib/cbt/access";

export const Route = createFileRoute("/_authenticated/admin/ujian/$id/token")({
  component: TokenPage,
});

function TokenPage() {
  const { id } = useParams({ from: "/_authenticated/admin/ujian/$id/token" });
  const user = useAuthStore((s) => s.user);
  const initialUjian = ujianRepo.byId(id);

  const initialAllowed = initialUjian ? ujianTouchesAllowed(user, initialUjian) : null;
  const [ujian, setUjian] = useState<Ujian | null>(
    initialUjian && initialAllowed ? initialUjian : null,
  );
  const [tokens, setTokens] = useState<TokenUjian[]>([]);
  const [users, setUsers] = useState(usersRepo.all());
  const [loadingRemote, setLoadingRemote] = useState(initialUjian === undefined);
  const [denied, setDenied] = useState(initialUjian !== undefined && initialAllowed === false);

  const [jumlah, setJumlah] = useState(10);
  const [customKode, setCustomKode] = useState("");
  const [expireDate, setExpireDate] = useState("");
  const [applyToAll, setApplyToAll] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (ujian === null || denied) return;
    setTokens(tokenRepo.all().filter((t) => t.ujianId === id));
    setUsers(usersRepo.all());
  }, [id, ujian, denied]);

  useEffect(() => {
    if (initialUjian !== undefined) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await fetchUjianByIdServer({ data: { id } });
        if (cancelled) return;
        if (result.ok && result.ujian) {
          if (ujianTouchesAllowed(user, result.ujian)) {
            setUjian(result.ujian);
          } else {
            setDenied(true);
          }
        } else if (result.error === "Forbidden") {
          setDenied(true);
        }
      } catch {
        // Fallback for network error
      } finally {
        if (!cancelled) setLoadingRemote(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, initialUjian, user]);

  function refresh() {
    setTokens(tokenRepo.all().filter((t) => t.ujianId === id));
  }

  async function generate() {
    if (generating) return;
    setGenerating(true);
    try {
      const expireAtMs = expireDate ? new Date(expireDate).getTime() : undefined;
      if (expireAtMs && expireAtMs <= Date.now()) {
        toast.error("Waktu kedaluwarsa harus di masa depan");
        setGenerating(false);
        return;
      }

      const result = await generateExamTokensServer({
        data: {
          ujianId: id,
          jumlah: customKode ? 1 : jumlah,
          customKode: customKode.trim() || undefined,
          expireAtMs,
          applyToAll,
        },
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      for (const tok of result.tokens) {
        tokenRepo.upsert(tok);
      }
      await tokenRepo.flush();
      toast.success(`${result.tokens.length} token berhasil disimpan`);
      setCustomKode("");
      refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Gagal membuat token: ${message}`);
    } finally {
      setGenerating(false);
    }
  }

  async function hapusToken(tokenId: string) {
    if (!confirm("Hapus token ini?")) return;
    try {
      const res = await deleteExamTokenServer({ data: { id: tokenId } });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      tokenRepo.remove(tokenId);
      await tokenRepo.flush();
      refresh();
      toast.success("Token dihapus");
    } catch {
      toast.error("Gagal menghapus token");
    }
  }

  function copyAll() {
    const validTokens = tokens
      .filter((t) => !t.expireAt || t.expireAt > Date.now())
      .map((t) => t.kode);

    if (validTokens.length === 0) {
      toast.error("Tidak ada token aktif yang tersedia untuk disalin");
      return;
    }

    navigator.clipboard.writeText(validTokens.join("\n"));
    toast.success(`${validTokens.length} token disalin ke clipboard`);
  }

  if (loadingRemote) {
    return <div className="text-sm text-muted-foreground p-4">Memuat…</div>;
  }

  if (denied) {
    return (
      <div className="max-w-4xl space-y-3 p-4">
        <div>
          <Link to="/admin/ujian" className="text-sm text-muted-foreground hover:underline">
            ← Paket ujian
          </Link>
        </div>
        <div className="rounded-md border bg-muted/30 p-4 text-sm">
          <div className="flex items-center gap-2 font-medium">
            <Lock className="h-4 w-4" />
            Anda tidak dapat mengelola token untuk ujian ini.
          </div>
          <p className="mt-1 text-muted-foreground">
            Token ujian hanya tersedia untuk topik yang termasuk dalam cakupan{" "}
            <code>allowedTopikIds</code> Anda.
          </p>
        </div>
      </div>
    );
  }

  if (!ujian) return <div className="p-4">Tidak ditemukan</div>;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="space-y-1">
        <Link to="/admin/ujian" className="text-sm text-muted-foreground hover:underline">
          ← Kembali ke Paket Ujian
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Kelola Token: {ujian.nama}</h1>
          <Link
            to="/admin/ujian/$id"
            params={{ id: ujian.id }}
            className="text-xs text-primary underline"
          >
            Buka Editor Ujian →
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">
          {ujian.tokenAktif
            ? "Token ujian aktif. Peserta wajib memasukkan salah satu token valid sebelum memulai ujian."
            : "Token tidak diwajibkan saat ini. Anda dapat mengaktifkannya di pengaturan ujian."}
        </p>
      </div>

      <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Buat Token Baru / Master Token
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Kolom 1: Pembuatan Kode */}
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold">Mode Pembuatan</h4>
                <p className="text-xs text-muted-foreground">Pilih acak otomatis atau kode kustom/master token.</p>
              </div>

              <div className="p-3 bg-muted/20 rounded-lg border space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">1. Acak Otomatis (Jumlah)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={500}
                    value={jumlah}
                    onChange={(e) => setJumlah(Math.max(1, Number(e.target.value)))}
                    className="h-9"
                    disabled={customKode.length > 0}
                  />
                </div>

                <div className="relative flex items-center justify-center py-1">
                  <span className="bg-background px-2 text-[10px] uppercase font-bold text-muted-foreground absolute">
                    Atau
                  </span>
                  <div className="w-full border-t"></div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">2. Custom / Master Token Kode</Label>
                  <Input
                    type="text"
                    value={customKode}
                    onChange={(e) => setCustomKode(e.target.value.toUpperCase())}
                    placeholder="Contoh: CBT-2026"
                    className="h-9 font-mono text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Kolom 2: Aturan Masa Berlaku & Cakupan */}
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold">Masa Berlaku & Cakupan</h4>
                <p className="text-xs text-muted-foreground">Atur jadwal kedaluwarsa dan penyebaran token.</p>
              </div>

              <div className="p-3 bg-muted/20 rounded-lg border space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-primary" /> Batas Waktu Kedaluwarsa
                  </Label>
                  <Input
                    type="datetime-local"
                    value={expireDate}
                    onChange={(e) => setExpireDate(e.target.value)}
                    className="h-9 text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground">Kosongkan jika token berlaku selamanya.</p>
                </div>

                <div className="pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="applyAll"
                      checked={applyToAll}
                      onCheckedChange={(c) => setApplyToAll(c === true)}
                    />
                    <Label htmlFor="applyAll" className="text-xs font-medium cursor-pointer">
                      Terapkan token ke semua ujian
                    </Label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-4 flex items-center justify-between border-t">
            <Button variant="outline" onClick={copyAll} size="sm">
              <Copy className="mr-2 h-4 w-4" />
              Salin Token Aktif
            </Button>

            <Button onClick={generate} disabled={generating} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              {generating ? "Menyimpan…" : "Buat Token"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3 px-4 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Daftar Token Ujian ({tokens.length})</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left">
              <tr>
                <th className="p-3">Kode Token</th>
                <th className="p-3">Status</th>
                <th className="p-3">Kedaluwarsa</th>
                <th className="p-3">Terakhir Dipakai</th>
                <th className="p-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((t) => {
                const isExpired = t.expireAt ? t.expireAt < Date.now() : false;
                const u = users.find((x) => x.id === t.dipakaiOleh);

                return (
                  <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-mono font-semibold">{t.kode}</td>
                    <td className="p-3">
                      {isExpired ? (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-2 py-0.5 text-xs font-medium">
                          <AlertCircle className="w-3 h-3" /> Kedaluwarsa
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 text-xs font-medium">
                          <CheckCircle2 className="w-3 h-3" /> Aktif
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {t.expireAt ? new Date(t.expireAt).toLocaleString("id-ID") : "Selamanya"}
                    </td>
                    <td className="p-3 text-xs">
                      {u ? `${u.namaLengkap} (${t.dipakaiAt ? new Date(t.dipakaiAt).toLocaleTimeString("id-ID") : ""})` : "-"}
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => hapusToken(t.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {tokens.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    Belum ada token. Buat token melalui formulir di atas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
