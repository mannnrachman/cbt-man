import { useState, useEffect } from "react";
import { tokenRepo } from "@/lib/cbt/repos";
import { generateExamTokensServer } from "@/lib/server/ujian/functions";
import type { TokenUjian, Ujian } from "@/lib/cbt/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Copy, KeyRound } from "lucide-react";
import { toast } from "sonner";

export function TokenManager({ ujian }: { ujian: Ujian }) {
  const [tokens, setTokens] = useState<TokenUjian[]>([]);
  const [jumlah, setJumlah] = useState(10);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    setTokens(tokenRepo.all().filter((t) => t.ujianId === ujian.id));
  }, [ujian.id]);

  function refresh() {
    setTokens(tokenRepo.all().filter((t) => t.ujianId === ujian.id));
  }

  async function generate() {
    if (generating) return;
    setGenerating(true);
    try {
      const result = await generateExamTokensServer({
        data: { ujianId: ujian.id, jumlah },
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      for (const tok of result.tokens) {
        tokenRepo.upsert(tok);
      }
      await tokenRepo.flush();
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

  return (
    <Card className="mt-6 border-slate-200 dark:border-slate-800 shadow-sm" id="token">
      <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-slate-500" />
          Kelola Token
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          {ujian.tokenAktif
            ? "Token ujian aktif. Peserta harus menginput salah satu kode di bawah."
            : "Token tidak diwajibkan saat ini. Aktifkan di pengaturan utama jika perlu."}
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="p-4 flex flex-wrap items-end gap-3 border-b border-slate-100 dark:border-slate-800">
          <div className="space-y-1">
            <Label className="text-xs font-medium">Jumlah token baru</Label>
            <Input
              type="number"
              min={1}
              max={500}
              value={jumlah}
              onChange={(e) => setJumlah(Math.max(1, Number(e.target.value)))}
              className="w-32 h-9"
            />
          </div>
          <Button onClick={generate} disabled={generating} size="sm" className="h-9">
            <Plus className="mr-1 h-4 w-4" />
            {generating ? "Membuat…" : "Generate"}
          </Button>
          <Button variant="outline" onClick={copyAll} size="sm" className="h-9 ml-auto">
            <Copy className="mr-1 h-4 w-4" />
            Salin yang belum dipakai
          </Button>
        </div>

        <div className="max-h-[400px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left sticky top-0 backdrop-blur-sm shadow-sm">
              <tr>
                <th className="p-3 font-medium text-slate-600 dark:text-slate-400">Kode</th>
                <th className="p-3 font-medium text-slate-600 dark:text-slate-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((t) => {
                return (
                  <tr key={t.id} className="border-b last:border-0 border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                    <td className="p-3 font-mono text-slate-900 dark:text-slate-100">{t.kode}</td>
                    <td className="p-3">
                      {t.dipakaiOleh ? (
                        <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-600/20 dark:bg-rose-950 dark:text-rose-400 dark:ring-rose-400/20">Terpakai</span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-400 dark:ring-emerald-400/20">Tersedia</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {tokens.length === 0 && (
                <tr>
                  <td colSpan={2} className="p-8 text-center text-slate-500 dark:text-slate-400">
                    Belum ada token.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
