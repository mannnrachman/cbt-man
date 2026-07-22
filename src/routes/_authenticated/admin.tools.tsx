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
import { AdminPage, AdminPageHeader } from "@/components/cbt/AdminPage";

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
        toast.error("Struktur backup tidak valid");
        return;
      }
      setPreview(parsed.data);
      setValidationErrors(null);
    };
    reader.readAsText(f);
  }

  function doRestore() {
    if (!preview) return;
    try {
      importBackup(preview);
      toast.success("Restore berhasil! Aplikasi akan disegarkan...");
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }

  function doReset() {
    if (confirmText !== "HAPUS") {
      toast.error("Ketik 'HAPUS' untuk konfirmasi");
      return;
    }
    resetAllData();
    ensureSeed();
    toast.success("Database berhasil dikosongkan! Memuat data awal...");
    setTimeout(() => window.location.reload(), 1500);
  }

  return (
    <AdminPage>
      <AdminPageHeader
        title="Alat Sistem"
        description="Fasilitas pencadangan data (backup), pemulihan (restore), dan pengaturan ulang pangkalan data."
      />

      {/* Section 1: Backup & Restore */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-12">
        <div className="space-y-2 lg:col-span-1">
          <h2 id="backup-heading" className="text-lg font-semibold text-slate-900 dark:text-white">Pencadangan Data</h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            Amankan data aplikasi secara berkala atau pulihkan dari cadangan sebelumnya. Cadangan mencakup seluruh pengguna, soal, ujian, dan konfigurasi.
          </p>
        </div>
        <div role="region" aria-labelledby="backup-heading" className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
          
          {/* Export Backup Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 p-6 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                  <Download className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Unduh Berkas Cadangan</h3>
              </div>
              <p className="text-xs text-slate-500 pl-8">Menghasilkan berkas JSON tunggal berisi snapshot pangkalan data saat ini.</p>
            </div>
            <div className="shrink-0">
              <Button onClick={() => void downloadBackup()} className="w-full sm:w-auto shadow-sm">
                Unduh Backup
              </Button>
            </div>
          </div>

          {/* Restore Backup Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 p-6 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                  <Upload className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Pulihkan dari Cadangan</h3>
              </div>
              <p className="text-xs text-slate-500 pl-8">Pilih berkas JSON cadangan. Struktur data akan divalidasi terlebih dahulu.</p>
            </div>
            <div className="shrink-0 flex gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                aria-hidden="true"
                onChange={handleFile}
              />
              <Button variant="outline" onClick={() => fileRef.current?.click()} className="w-full sm:w-auto bg-white dark:bg-slate-950">
                Pilih Berkas JSON...
              </Button>
            </div>
          </div>

        </div>
      </div>

      <div className="h-px w-full bg-slate-200 dark:bg-slate-800/60 my-10" />

      {/* Section 2: Pemeliharaan Pangkalan Data */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-12">
        <div className="space-y-2 lg:col-span-1">
          <h2 id="advanced-heading" className="text-lg font-semibold text-slate-900 dark:text-white">Pengelolaan Lanjut</h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            Aksi-aksi kritikal untuk memanipulasi pangkalan data sistem secara langsung.
          </p>
        </div>
        <div role="region" aria-labelledby="advanced-heading" className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
          
          {/* Seed Data Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 p-6 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  <RefreshCw className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Inisialisasi Data Demo</h3>
              </div>
              <p className="text-xs text-slate-500 pl-8">Isi pangkalan data kosong dengan sampel otomatis (pengguna, soal, ujian).</p>
            </div>
            <div className="shrink-0">
              <Button variant="outline" onClick={() => {
                ensureSeed();
                toast.success("Seed data dimuat (hanya jika kosong).");
                setTimeout(() => window.location.reload(), 600);
              }} className="w-full sm:w-auto bg-white dark:bg-slate-950">
                Muat Seed Data
              </Button>
            </div>
          </div>

          {/* Reset Data Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 p-6 bg-red-50/30 dark:bg-red-950/10 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">Zona Berbahaya: Hapus Semua Data</h3>
              </div>
              <p className="text-xs font-medium text-red-700 dark:text-red-400 pl-8">Tindakan ini akan mengosongkan seluruh pangkalan data. Tidak dapat dibatalkan!</p>
            </div>
            <div className="shrink-0">
              <Button variant="destructive" onClick={() => setConfirmReset(true)} className="w-full sm:w-auto font-semibold">
                <Trash2 className="mr-2 h-4 w-4" /> Reset Keseluruhan
              </Button>
            </div>
          </div>

        </div>
      </div>

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
            <Button onClick={doRestore}>Terapkan restore</Button>
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
    </AdminPage>
  );
}
