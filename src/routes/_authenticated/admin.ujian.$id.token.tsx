import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ujianRepo, tokenRepo, usersRepo } from "@/lib/cbt/repos";
import { fetchUjianByIdServer, generateExamTokensServer } from "@/lib/server/ujian/functions";
import type { TokenUjian, Ujian } from "@/lib/cbt/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Copy, Lock } from "lucide-react";
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

  // (Must-fix #2) Re-order guards: do NOT call `tokenRepo.all()` /
  // `setTokens(...)` until we have confirmed the operator is allowed to
  // touch this ujian. Previously the token list was materialized into
  // React state before the `ujianTouchesAllowed` check fired, which is
  // a defence-in-depth regression in the stale-cache scenario.
  //
  // (Must-fix #3) Same direct-URL pattern as the exam editor: if the
  // ujian is missing from the snapshot we ask the server to confirm
  // existence so we can distinguish "tidak ditemukan" from "lock screen".
  const initialAllowed = initialUjian ? ujianTouchesAllowed(user, initialUjian) : null;
  const [ujian, setUjian] = useState<Ujian | null>(
    initialUjian && initialAllowed ? initialUjian : null,
  );
  const [tokens, setTokens] = useState<TokenUjian[]>([]);
  const [users, setUsers] = useState(usersRepo.all());
  const [loadingRemote, setLoadingRemote] = useState(initialUjian === undefined);
  const [denied, setDenied] = useState(initialUjian !== undefined && initialAllowed === false);
  const [jumlah, setJumlah] = useState(10);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (ujian === null || denied) return;
    // Hanya muat tokens + users setelah kita yakin ujian boleh disentuh.
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
        // Network/server error: fall through to "tidak ditemukan" so the
        // operator sees a stable empty state instead of a stuck spinner.
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
      // Server-side crypto-random generation. The client never sees the
      // random source — `randomBytes` is invoked inside the server function
      // (see `generateExamTokensServer` in `src/lib/server/ujian/functions.ts`).
      const result = await generateExamTokensServer({
        data: { ujianId: id, jumlah },
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      // Persist the returned tokens into the client cache via the existing
      // repo upsert path so the table re-renders.
      for (const tok of result.tokens) {
        tokenRepo.upsert(tok);
      }
      toast.success(`${result.tokens.length} token dibuat`);
      refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Gagal membuat token: ${message}`);
    } finally {
      setGenerating(false);
    }
  }

  function copyAll() {
    const tersedia = tokens
      .filter((t) => !t.dipakaiOleh)
      .map((t) => t.kode)
      .join("\n");
    navigator.clipboard.writeText(tersedia);
    toast.success("Disalin");
  }

  if (loadingRemote) {
    return <div className="text-sm text-muted-foreground">Memuat…</div>;
  }

  if (denied) {
    return (
      <div className="max-w-3xl space-y-3">
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
            <code>allowedTopikIds</code> Anda. Hubungi admin jika menurut Anda ini keliru.
          </p>
        </div>
      </div>
    );
  }

  if (!ujian) return <div>Tidak ditemukan</div>;

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <Link to="/admin/ujian" className="text-sm text-muted-foreground hover:underline">
          ← Paket ujian
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Token: {ujian.nama}</h1>
        <p className="text-sm text-muted-foreground">
          {ujian.tokenAktif
            ? "Token aktif — peserta harus input salah satu kode di bawah."
            : "Token tidak diwajibkan. Aktifkan di Editor Ujian dulu jika perlu."}
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-2 p-4">
          <div>
            <Label>Jumlah token baru</Label>
            <Input
              type="number"
              min={1}
              max={500}
              value={jumlah}
              onChange={(e) => setJumlah(Math.max(1, Number(e.target.value)))}
              className="w-32"
            />
          </div>
          <Button onClick={generate} disabled={generating}>
            <Plus className="mr-1 h-4 w-4" />
            {generating ? "Membuat…" : "Generate"}
          </Button>
          <Button variant="outline" onClick={copyAll}>
            <Copy className="mr-1 h-4 w-4" />
            Salin yang belum dipakai
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left">
              <tr>
                <th className="p-3">Kode</th>
                <th className="p-3">Status</th>
                <th className="p-3">Dipakai oleh</th>
                <th className="p-3">Waktu</th>
                <th className="p-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((t) => {
                const u = users.find((x) => x.id === t.dipakaiOleh);
                return (
                  <tr key={t.id} className="border-b last:border-0">
                    <td className="p-3 font-mono">{t.kode}</td>
                    <td className="p-3">
                      {t.dipakaiOleh ? (
                        <span className="rounded bg-muted px-2 py-0.5 text-xs">Terpakai</span>
                      ) : (
                        <span className="rounded bg-success/20 px-2 py-0.5 text-xs text-success">
                          Tersedia
                        </span>
                      )}
                    </td>
                    <td className="p-3">{u?.namaLengkap ?? "-"}</td>
                    <td className="p-3 text-xs">
                      {t.dipakaiAt ? new Date(t.dipakaiAt).toLocaleString("id-ID") : "-"}
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (!confirm("Hapus token?")) return;
                          tokenRepo.remove(t.id);
                          refresh();
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {tokens.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-muted-foreground">
                    Belum ada token. Klik Generate.
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
