import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  downloadBackup,
  importBackup,
  resetAllData,
  backupSummary,
  BackupSchema,
  type Backup,
} from "@/lib/cbt/backup";
import { ensureSeed } from "@/lib/cbt/seed";
import { Download, Upload, Trash2, AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/tools")({
  component: ToolsPage,
});

type ValidationIssue = { path: string; message: string; code?: string };

function ToolsPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Backup | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationIssue[] | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      let json: unknown;
      try {
        json = JSON.parse(String(reader.result));
      } catch {
        toast.error("File bukan JSON yang valid");
        return;
      }
      const parsed = BackupSchema.safeParse(json);
      if (!parsed.success) {
        const issues: ValidationIssue[] = parsed.error.issues.map((iss) => ({
          path: iss.path.length ? iss.path.join(".") : "(root)",
          message: iss.message,
          code: iss.code,
        }));
        setValidationErrors(issues);
        toast.error(
          `Struktur backup tidak valid (${issues.length} masalah). Lihat detail di dialog.`,
        );
        return;
      }
      setValidationErrors(null);
      setPreview(parsed.data);
    };
    reader.readAsText(f);
    e.target.value = "";
  }

  async function applyImport() {
    if (!preview) return;
    try {
      await importBackup(preview);
      toast.success("Restore database berhasil. Memuat ulang…");
      setPreview(null);
      setTimeout(() => window.location.reload(), 600);
    } catch (err) {
      toast.error("Gagal restore: " + (err as Error).message);
    }
  }

  async function doReset() {
    if (confirmText !== "HAPUS") {
      toast.error('Ketik "HAPUS" untuk konfirmasi');
      return;
    }
    await resetAllData();
    toast.success("Semua data database dihapus. Memuat ulang…");
    setTimeout(() => window.location.reload(), 600);
  }

  async function doReseed() {
    await ensureSeed();
    toast.success("Seed data dimuat (hanya jika kosong).");
    setTimeout(() => window.location.reload(), 600);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link to="/admin" className="text-sm text-muted-foreground hover:underline">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Backup &amp; Tools</h1>
        <p className="text-sm text-muted-foreground">
          Export, restore, atau reset seluruh data aplikasi dari database SQLite.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" /> Export Backup
          </CardTitle>
          <CardDescription>
            Unduh seluruh data (pengguna, bank soal, ujian, sesi, konfigurasi) sebagai 1 file JSON.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => void downloadBackup()}>
            <Download className="mr-1 h-4 w-4" /> Download backup
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" /> Restore Backup
          </CardTitle>
          <CardDescription>
            Pilih file backup JSON. Struktur akan divalidasi sebelum diterapkan (preview dulu).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleFile}
          />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="mr-1 h-4 w-4" /> Pilih file…
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" /> Muat Seed Data
          </CardTitle>
          <CardDescription>
            Memuat data demo (admin, guru, peserta, soal, ujian) jika database masih kosong.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={doReseed}>
            Muat seed
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" /> Zona Berbahaya
          </CardTitle>
          <CardDescription>
            Hapus seluruh data database SQLite. Aksi ini tidak bisa dibatalkan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => setConfirmReset(true)}>
            <Trash2 className="mr-1 h-4 w-4" /> Reset semua data
          </Button>
        </CardContent>
      </Card>

      {/* Preview import */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Preview restore</DialogTitle>
            <DialogDescription>
              Data berikut akan menggantikan seluruh data yang ada saat ini.
            </DialogDescription>
          </DialogHeader>
          {preview && (
            <div className="rounded border bg-muted/30 p-3 text-sm">
              <div className="mb-2 text-xs text-muted-foreground">
                Diekspor: {new Date(preview.exportedAt).toLocaleString()}
              </div>
              <ul className="grid grid-cols-2 gap-1">
                {Object.entries(backupSummary(preview)).map(([k, v]) => (
                  <li key={k} className="flex justify-between">
                    <span className="text-muted-foreground capitalize">{k}</span>
                    <span className="font-mono">{v}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPreview(null)}>
              Batal
            </Button>
            <Button onClick={applyImport}>Terapkan restore</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset confirm */}
      <Dialog
        open={confirmReset}
        onOpenChange={(o) => {
          if (!o) {
            setConfirmReset(false);
            setConfirmText("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Reset semua data?</DialogTitle>
            <DialogDescription>
              Semua pengguna, soal, ujian, dan sesi akan terhapus. Ketik <strong>HAPUS</strong>{" "}
              untuk konfirmasi.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="confirm">Konfirmasi</Label>
            <Input
              id="confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="HAPUS"
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setConfirmReset(false);
                setConfirmText("");
              }}
            >
              Batal
            </Button>
            <Button variant="destructive" onClick={doReset}>
              Reset sekarang
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Validation errors */}
      <Dialog open={!!validationErrors} onOpenChange={(o) => !o && setValidationErrors(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> Struktur backup tidak valid
            </DialogTitle>
            <DialogDescription>
              Data tidak ditimpa. Perbaiki file lalu coba lagi. Ditemukan{" "}
              {validationErrors?.length ?? 0} masalah:
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-auto rounded border bg-muted/30 text-sm">
            <table className="w-full">
              <thead className="sticky top-0 bg-muted text-left text-xs">
                <tr>
                  <th className="p-2">#</th>
                  <th className="p-2">Path</th>
                  <th className="p-2">Pesan</th>
                  <th className="p-2">Kode</th>
                </tr>
              </thead>
              <tbody>
                {validationErrors?.map((iss, i) => (
                  <tr key={i} className="border-t align-top">
                    <td className="p-2 text-muted-foreground">{i + 1}</td>
                    <td className="p-2 font-mono text-xs">{iss.path}</td>
                    <td className="p-2">{iss.message}</td>
                    <td className="p-2 font-mono text-xs text-muted-foreground">{iss.code}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DialogFooter>
            <Button onClick={() => setValidationErrors(null)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
