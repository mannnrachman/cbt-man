import { useState, useEffect } from "react";
import { tokenRepo } from "@/lib/cbt/repos";
import { generateExamTokensServer, deleteExamTokenServer } from "@/lib/server/ujian/functions";
import type { TokenUjian, Ujian } from "@/lib/cbt/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Copy, KeyRound, Trash2, Clock } from "lucide-react";
import { toast } from "sonner";

export function TokenManager({ ujian }: { ujian: Ujian }) {
  const [tokens, setTokens] = useState<TokenUjian[]>([]);
  const [jumlah, setJumlah] = useState(10);
  const [customKode, setCustomKode] = useState("");
  const [durasiMenit, setDurasiMenit] = useState("");
  const [applyToAll, setApplyToAll] = useState(false);
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
        data: { 
          ujianId: ujian.id, 
          jumlah,
          customKode: customKode.trim() || undefined,
          durasiMenit: durasiMenit ? Number(durasiMenit) : undefined,
          applyToAll
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
      toast.success(`${result.tokens.length} token dibuat`);
      setCustomKode("");
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

  async function hapusToken(id: string) {
    if (!confirm("Hapus token ini?")) return;
    try {
      const res = await deleteExamTokenServer({ data: { id } });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      tokenRepo.remove(id);
      await tokenRepo.flush();
      refresh();
      toast.success("Token dihapus");
    } catch (err) {
      toast.error("Gagal menghapus token");
    }
  }

  const validTokens = tokens.filter(t => !t.expireAt || t.expireAt > Date.now());

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
        <div className="p-4 flex flex-col md:flex-row items-end gap-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-end gap-3 flex-1">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Jumlah token (Auto)</Label>
              <Input
                type="number"
                min={1}
                max={500}
                value={jumlah}
                onChange={(e) => setJumlah(Math.max(1, Number(e.target.value)))}
                className="w-32 h-9"
                disabled={customKode.length > 0}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-500">ATAU Custom Kode</Label>
              <Input
                type="text"
                value={customKode}
                onChange={(e) => setCustomKode(e.target.value.toUpperCase())}
                placeholder="Misal: MTK-2026"
                className="w-40 h-9 font-mono text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Durasi (Menit)
              </Label>
              <Input
                type="number"
                min={0}
                value={durasiMenit}
                onChange={(e) => setDurasiMenit(e.target.value)}
                placeholder="0 = Selamanya"
                className="w-32 h-9"
              />
            </div>
            <Button onClick={generate} disabled={generating} size="sm" className="h-9">
              <Plus className="mr-1 h-4 w-4" />
              {generating ? "Membuat…" : "Buat Token"}
            </Button>
          </div>
          <div className="w-full flex items-center gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Checkbox id="applyAll" checked={applyToAll} onCheckedChange={(c) => setApplyToAll(c === true)} />
            <Label htmlFor="applyAll" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Juga terapkan token ini ke semua ujian lain yang Anda kelola (Master Token)
            </Label>
          </div>
        </div>
        <div className="w-full flex justify-end p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30">
          <Button variant="outline" onClick={copyAll} size="sm" className="h-9">
            <Copy className="mr-1 h-4 w-4" />
            Salin Tersedia
          </Button>
        </div>

        <div className="max-h-[400px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left sticky top-0 backdrop-blur-sm shadow-sm">
              <tr>
                <th className="p-3 font-medium text-slate-600 dark:text-slate-400">Kode</th>
                <th className="p-3 font-medium text-slate-600 dark:text-slate-400">Status</th>
                <th className="p-3 font-medium text-slate-600 dark:text-slate-400 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {validTokens.map((t) => {
                return (
                  <tr key={t.id} className="border-b last:border-0 border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                    <td className="p-3 font-mono text-slate-900 dark:text-slate-100 font-semibold">{t.kode}</td>
                    <td className="p-3">
                      {t.dipakaiOleh ? (
                        <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-600/20 dark:bg-rose-950 dark:text-rose-400 dark:ring-rose-400/20">Terpakai</span>
                      ) : (
                        <div className="flex flex-col items-start">
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-400 dark:ring-emerald-400/20 mb-1">Tersedia</span>
                          {t.expireAt && (
                            <span className="text-[10px] text-slate-500 font-medium">
                              S/d: {new Date(t.expireAt).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-destructive hover:bg-destructive/10" onClick={() => hapusToken(t.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {validTokens.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-slate-500 dark:text-slate-400">
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
