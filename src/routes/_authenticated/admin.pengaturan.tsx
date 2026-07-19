import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { configRepo, hydrateRepos } from "@/lib/cbt/repos";
import { ConfigSchema } from "@/lib/cbt/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Settings, Upload, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/pengaturan")({
  loader: async () => {
    try {
      await hydrateRepos();
    } catch {
      // Fallback ke cache; jangan brick navigasi saat snapshot gagal.
    }
  },
  component: PengaturanPage,
});

function PengaturanPage() {
  const [cfg, setCfg] = useState(configRepo.get());
  const fileInputRef = useRef<HTMLInputElement>(null);

  function save() {
    const parsed = ConfigSchema.safeParse(cfg);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Konfigurasi tidak valid");
      return;
    }
    configRepo.set(parsed.data);
    toast.success("Pengaturan disimpan.");
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("File harus berupa gambar (PNG, JPG, dll).");
      return;
    }

    try {
      const base64Str = await resizeImage(file, 200);
      setCfg({ ...cfg, appLogo: base64Str });
      toast.success("Logo berhasil ditambahkan.");
    } catch (err) {
      toast.error("Gagal memproses gambar logo.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-zinc-100">
            Pengaturan Aplikasi
          </h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            Konfigurasi institusi, keamanan, browser ujian, dan branding CBT.
          </p>
        </div>
        <Button onClick={save} className="h-10 px-8 shadow-sm">
          Simpan Semua
        </Button>
      </div>

      {/* Section 1: Identitas Aplikasi */}
      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Identitas Aplikasi</h2>
          <p className="text-sm text-slate-500">
            Informasi ini akan ditampilkan di halaman login dan pada panel atas dasbor aplikasi.
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-6 space-y-6">
            
            <div className="space-y-2.5">
              <Label className="text-slate-700 dark:text-slate-300 font-semibold">Nama Aplikasi</Label>
              <Input
                value={cfg.appName}
                onChange={(e) => setCfg({ ...cfg, appName: e.target.value })}
                className="max-w-md bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
              />
            </div>

            <div className="space-y-2.5">
              <Label className="text-slate-700 dark:text-slate-300 font-semibold">Logo Aplikasi</Label>
              <div className="flex flex-col sm:flex-row gap-6 items-start">
                <div className="h-20 w-20 shrink-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 flex items-center justify-center overflow-hidden">
                  {cfg.appLogo ? (
                    <img src={cfg.appLogo} alt="Logo" className="h-12 w-12 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} onLoad={(e) => (e.currentTarget.style.display = 'block')} />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-slate-300" />
                  )}
                </div>
                <div className="flex-1 space-y-3 w-full">
                  <div className="flex gap-2 max-w-md">
                    <Input
                      value={cfg.appLogo ?? ""}
                      placeholder="https://... atau klik Upload"
                      onChange={(e) => setCfg({ ...cfg, appLogo: e.target.value })}
                      className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 font-mono text-xs"
                    />
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      ref={fileInputRef} 
                      onChange={handleLogoUpload}
                    />
                    <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()} className="shrink-0 shadow-sm border-slate-200 dark:border-slate-700">
                      <Upload className="h-4 w-4 mr-2" /> Upload
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500">Mendukung format PNG/JPG. Gambar akan diubah ukurannya secara otomatis (max 200px).</p>
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              <Label className="text-slate-700 dark:text-slate-300 font-semibold">Deskripsi Singkat</Label>
              <Textarea
                value={cfg.appDeskripsi}
                onChange={(e) => setCfg({ ...cfg, appDeskripsi: e.target.value })}
                className="min-h-[80px] bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
              />
            </div>

            <div className="space-y-2.5">
              <Label className="text-slate-700 dark:text-slate-300 font-semibold">Pengumuman Halaman Login</Label>
              <Textarea
                value={cfg.pesanLogin}
                onChange={(e) => setCfg({ ...cfg, pesanLogin: e.target.value })}
                className="min-h-[80px] bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                placeholder="Ketik pengumuman atau instruksi untuk peserta..."
              />
            </div>

          </div>
        </div>
      </div>

      <div className="h-px w-full bg-slate-200 dark:bg-slate-800/60" />

      {/* Section 2: Kebijakan Ujian */}
      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Kebijakan Ujian</h2>
          <p className="text-sm text-slate-500">
            Konfigurasi keamanan dan pembatasan akses perangkat untuk melindungi integritas pelaksanaan ujian.
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
          <ToggleRow
            label="Kunci akses dari perangkat Mobile"
            desc="Mencegah peserta mengakses aplikasi ujian melalui smartphone atau tablet."
            checked={cfg.mobileLock}
            onChange={(v) => setCfg({ ...cfg, mobileLock: v })}
            disabled
            badge="Belum Tersedia"
          />
          <ToggleRow
            label="Izinkan Multi-Device"
            desc="Mengizinkan satu akun mahasiswa login dari lebih dari satu perangkat pada waktu yang bersamaan."
            checked={cfg.multiDevice}
            onChange={(v) => setCfg({ ...cfg, multiDevice: v })}
            disabled
            badge="Belum Tersedia"
          />
        </div>
      </div>

    </div>
  );
}

function ToggleRow({
  label,
  desc,
  checked,
  onChange,
  disabled = false,
  badge,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  badge?: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 p-5 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-1">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{label}</h3>
          {badge && (
            <span className="rounded-md border border-amber-200/60 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 leading-relaxed pr-6">{desc}</p>
      </div>
      <div className="shrink-0 mt-3 sm:mt-0">
        <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} className="data-[state=checked]:bg-emerald-500" />
      </div>
    </div>
  );
}

async function resizeImage(file: File, maxWidthOrHeight: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidthOrHeight || height > maxWidthOrHeight) {
          if (width > height) {
            height = Math.round((height * maxWidthOrHeight) / width);
            width = maxWidthOrHeight;
          } else {
            width = Math.round((width * maxWidthOrHeight) / height);
            height = maxWidthOrHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas not supported"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        
        // Use webp for better compression, fallback to png
        resolve(canvas.toDataURL("image/webp", 0.8));
      };
      img.onerror = () => reject(new Error("Invalid image"));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
