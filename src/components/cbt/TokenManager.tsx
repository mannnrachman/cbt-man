import { useState } from "react";
import { tokenRepo } from "@/lib/cbt/repos";
import type { Ujian, TokenUjian } from "@/lib/cbt/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, KeyRound, Copy, Clock } from "lucide-react";
import { toast } from "sonner";
import { generateExamTokensServer, deleteExamTokenServer } from "@/lib/server/ujian/functions";

export function TokenManager({ ujian }: { ujian: Ujian }) {
  const [tokens, setTokens] = useState<TokenUjian[]>(
    () => tokenRepo.all().filter((t) => t.ujianId === ujian.id)
  );
  const [jumlah, setJumlah] = useState(5);
  const [customKode, setCustomKode] = useState("");
  const [expireDate, setExpireDate] = useState("");
  const [applyToAll, setApplyToAll] = useState(false);
  const [generating, setGenerating] = useState(false);

  function refresh() {
    setTokens(tokenRepo.all().filter((t) => t.ujianId === ujian.id));
  }

  async function generate() {
    setGenerating(true);
    try {
      const expireAtMs = expireDate ? new Date(expireDate).getTime() : undefined;
      const res = await generateExamTokensServer({
        data: {
          ujianId: ujian.id,
          jumlah,
          customKode: customKode.trim() || undefined,
          expireAtMs,
          applyToAll,
        },
      });

      if (!res.ok) {
        toast.error(res.error || "Gagal membuat token");
        setGenerating(false);
        return;
      }

      if (res.tokens) {
        for (const tk of res.tokens) {
          tokenRepo.upsert(tk);
        }
        await tokenRepo.flush();
      }

      refresh();
      setCustomKode("");
      toast.success(
        applyToAll
          ? "Master token berhasil dibuat untuk semua ujian"
          : "Token ujian berhasil dibuat"
      );
    } catch {
      toast.error("Terjadi kesalahan saat membuat token");
    } finally {
      setGenerating(false);
    }
  }

  function copyAll() {
    const list = tokens
      .filter((t) => !t.expireAt || t.expireAt > Date.now())
      .map((t) => t.kode)
      .join("\n");
    if (!list) {
      toast.error("Tidak ada token aktif");
      return;
    }
    navigator.clipboard.writeText(list);
    toast.success("Daftar token disalin");
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
    } catch {
      toast.error("Gagal menghapus token");
    }
  }

  const validTokens = tokens.filter((t) => !t.expireAt || t.expireAt > Date.now());

  return (
    <Card className="mt-6 border-slate-200 dark:border-slate-800 shadow-sm" id="token">
      <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-slate-500" />
          Kelola Token Ujian
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          {ujian.tokenAktif
            ? "Token ujian aktif. Peserta harus menginput salah satu kode di bawah."
            : "Token tidak diwajibkan saat ini. Aktifkan di pengaturan jika perlu."}
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Kolom 1: Mode Token */}
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Mode Token</h4>
                <p className="text-xs text-slate-500">Pilih salah satu cara pembuatan token.</p>
              </div>

              <div className="p-3 bg-white dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">1. Otomatis (Jumlah)</Label>
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

                <div className="relative flex items-center justify-center py-2">
                  <span className="bg-white dark:bg-slate-950 px-2 text-[10px] uppercase font-bold text-slate-400 absolute">Atau</span>
                  <div className="w-full border-t border-slate-100 dark:border-slate-800"></div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">2. Custom Kode</Label>
                  <Input
                    type="text"
                    value={customKode}
                    onChange={(e) => setCustomKode(e.target.value.toUpperCase())}
                    placeholder="Misal: MTK-2026"
                    className="h-9 font-mono text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Kolom 2: Aturan & Expire */}
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Pengaturan Lanjutan</h4>
                <p className="text-xs text-slate-500">Atur masa berlaku dan cakupan ujian.</p>
              </div>

              <div className="p-3 bg-white dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-500" /> Batas Kedaluwarsa
                  </Label>
                  <Input
                    type="datetime-local"
                    value={expireDate}
                    onChange={(e) => setExpireDate(e.target.value)}
                    className="h-9 text-sm"
                  />
                  <p className="text-[10px] text-slate-400 leading-tight">Kosongkan jika token berlaku selamanya.</p>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <Checkbox id="applyAll" checked={applyToAll} onCheckedChange={(c) => setApplyToAll(c === true)} />
                    <Label htmlFor="applyAll" className="text-sm font-medium cursor-pointer">
                      Terapkan ke semua ujian
                    </Label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="mt-5 pt-4 flex items-center justify-between border-t border-slate-200/60 dark:border-slate-700/60">
            <Button variant="outline" onClick={copyAll} size="sm" className="h-9">
              <Copy className="mr-2 h-4 w-4" />
              Salin Tersedia
            </Button>

            <Button onClick={generate} disabled={generating} size="sm" className="h-9 px-6 bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
              <Plus className="mr-2 h-4 w-4" />
              {generating ? "Membuat…" : "Buat Token"}
            </Button>
          </div>
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
                      <div className="flex flex-col items-start">
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-400 dark:ring-emerald-400/20 mb-1">
                          Aktif
                        </span>
                        {t.expireAt && (
                          <span className="text-[10px] text-slate-500 font-medium">
                            S/d: {new Date(t.expireAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                      </div>
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
