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
import { Settings, Upload, Image as ImageIcon, Save } from "lucide-react";
import { toast } from "sonner";
import { AdminPage, AdminPageHeader } from "@/components/cbt/AdminPage";
import { useThemeStore, type Accent, type FontSize, type FontType } from "@/lib/cbt/theme-store";
import { CheckCircle2 } from "lucide-react";


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
  const { font, setFont, fontSize, setFontSize, accent, setAccent } = useThemeStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function save() {
    const parsed = ConfigSchema.safeParse(cfg);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Konfigurasi tidak valid");
      return;
    }
    configRepo.set(parsed.data);
    const result = await configRepo.flush();
    if (result.ok) toast.success("Pengaturan disimpan.");
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
    <AdminPage className="">
      <AdminPageHeader
        title="Pengaturan Aplikasi"
        description="Konfigurasi institusi, keamanan, browser ujian, dan branding CBT."
        action={
          <Button onClick={save} className="h-10 px-8">
            Simpan Semua
          </Button>
        }
      />

      {/* Section 1: Identitas Aplikasi */}
      <div className="space-y-6">
        <div className="space-y-2">
          <h2 id="identitas-heading" className="text-lg font-semibold text-foreground">Identitas Aplikasi</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Informasi ini akan ditampilkan di halaman login dan pada panel atas dasbor aplikasi.
          </p>
        </div>
        <div role="region" aria-labelledby="identitas-heading" className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="p-6 space-y-6">

            <div className="space-y-2.5">
              <Label className="text-foreground font-semibold">Nama Aplikasi</Label>
              <Input
                value={cfg.appName}
                onChange={(e) => setCfg({ ...cfg, appName: e.target.value })}
                className="bg-muted border-border"
              />
            </div>

            <div className="space-y-2.5">
              <Label className="text-foreground font-semibold">Logo Aplikasi</Label>
              <div className="flex flex-col sm:flex-row gap-6 items-start">
                <div className="h-20 w-20 shrink-0 rounded-lg border border-border bg-muted flex items-center justify-center overflow-hidden">
                  {cfg.appLogo ? (
                    <img src={cfg.appLogo} alt="Logo" className="h-12 w-12 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} onLoad={(e) => (e.currentTarget.style.display = 'block')} />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 space-y-3 w-full">
                  <div className="flex gap-2">
                    <Input
                      value={cfg.appLogo ?? ""}
                      placeholder="https://... atau klik Upload"
                      onChange={(e) => setCfg({ ...cfg, appLogo: e.target.value })}
                      className="bg-muted border-border font-mono text-label"
                    />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      aria-hidden="true"
                      ref={fileInputRef}
                      onChange={handleLogoUpload}
                    />
                    <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()} className="shrink-0 border-border">
                      <Upload className="h-4 w-4 mr-2" /> Upload
                    </Button>
                  </div>
                  <p className="text-label text-muted-foreground">Mendukung format PNG/JPG. Gambar akan diubah ukurannya secara otomatis (max 200px).</p>
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              <Label className="text-foreground font-semibold">Deskripsi Singkat</Label>
              <Textarea
                value={cfg.appDeskripsi}
                onChange={(e) => setCfg({ ...cfg, appDeskripsi: e.target.value })}
                className="min-h-[80px] bg-muted border-border"
              />
            </div>

            <div className="space-y-2.5">
              <Label className="text-foreground font-semibold">Pengumuman Halaman Login</Label>
              <Textarea
                value={cfg.pesanLogin}
                onChange={(e) => setCfg({ ...cfg, pesanLogin: e.target.value })}
                className="min-h-[80px] bg-muted border-border"
                placeholder="Ketik pengumuman atau instruksi untuk peserta..."
              />
            </div>

          </div>
        </div>
      </div>

      <div className="h-px w-full bg-muted my-10" />

      {/* Section 2: Kebijakan Ujian */}
      <div className="space-y-6">
        <div className="space-y-2">
          <h2 id="kebijakan-heading" className="text-lg font-semibold text-foreground">Kebijakan Ujian</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Konfigurasi keamanan dan pembatasan akses perangkat untuk melindungi integritas pelaksanaan ujian.
          </p>
        </div>
        <div role="region" aria-labelledby="kebijakan-heading" className="bg-card rounded-lg border border-border overflow-hidden divide-y divide-border">

          <ToggleRow
            label="Kunci akses dari perangkat Mobile"
            desc="Mencegah peserta mengakses aplikasi ujian melalui smartphone atau tablet."
            checked={cfg.mobileLock}
            onChange={(v) => setCfg({ ...cfg, mobileLock: v })}
            disabled
            badge="Belum diberlakukan"
          />
          <ToggleRow
            label="Izinkan Multi-Device"
            desc="Mengizinkan satu akun mahasiswa login dari lebih dari satu perangkat pada waktu yang bersamaan."
            checked={cfg.multiDevice}
            onChange={(v) => setCfg({ ...cfg, multiDevice: v })}
            disabled
            badge="Belum diberlakukan"
          />
        </div>
      </div>

      <div className="h-px w-full bg-muted my-10" />

      {/* Section 3: Tema & Tampilan */}
      <div className="space-y-6">
        <div className="space-y-2">
          <h2 id="tema-heading" className="text-lg font-semibold text-foreground">Tema & Tampilan</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Sesuaikan gaya visual dan nuansa aplikasi. Tema dan tipografi ini akan diterapkan secara global untuk Anda.
          </p>
        </div>
        <div role="region" aria-labelledby="tema-heading" className="space-y-8">

          {/* Warna tema */}
          <fieldset className="space-y-3">
            <legend className="text-label font-semibold text-muted-foreground">Warna Tema</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {ACCENT_OPTIONS.map((opt) => (
                <OptionCard key={opt.value} selected={accent === opt.value} onSelect={() => setAccent(opt.value)}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-foreground">{opt.label}</span>
                    {accent === opt.value && <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0 text-foreground" />}
                  </div>
                  <div aria-hidden="true" className="mt-3 flex h-10 overflow-hidden rounded-md border border-border">
                    <span className="w-1/3" style={{ backgroundColor: opt.sidebar }} />
                    <span className="flex-1" style={{ backgroundColor: opt.surface }} />
                    <span className="w-1/4" style={{ backgroundColor: opt.action }} />
                  </div>
                  <p className="mt-2 text-label text-muted-foreground">{opt.desc}</p>
                </OptionCard>
              ))}
            </div>
          </fieldset>

          {/* Ukuran font */}
          <fieldset className="space-y-3">
            <legend className="text-label font-semibold text-muted-foreground">Ukuran Font</legend>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {SIZE_OPTIONS.map((opt) => (
                <OptionCard key={opt.value} selected={fontSize === opt.value} onSelect={() => setFontSize(opt.value)}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground">{opt.label}</span>
                    {fontSize === opt.value && <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0 text-foreground" />}
                  </div>
                  <div aria-hidden="true" className="mt-2 font-semibold text-foreground" style={{ fontSize: opt.sample }}>Aa 123</div>
                  <p className="mt-1 text-label text-muted-foreground">{opt.px}</p>
                </OptionCard>
              ))}
            </div>
          </fieldset>

          {/* Jenis font */}
          <fieldset className="space-y-3">
            <legend className="text-label font-semibold text-muted-foreground">Jenis Font</legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {FONT_OPTIONS.map((opt) => (
                <OptionCard key={opt.value} selected={font === opt.value} onSelect={() => setFont(opt.value)}>
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-foreground">{opt.label}</div>
                      <span className="text-label font-semibold text-muted-foreground">{opt.tag}</span>
                    </div>
                    {font === opt.value && <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0 text-foreground" />}
                  </div>
                  <div aria-hidden="true" className="rounded-lg border border-border bg-muted p-3" style={{ fontFamily: opt.family }}>
                    <div className="text-sm font-semibold text-foreground">Aa Bb Cc 123</div>
                    <div className="mt-1 text-label text-muted-foreground">Ujian Berbasis Komputer Modern</div>
                  </div>
                  <p className="mt-3 text-label text-muted-foreground">{opt.desc}</p>
                </OptionCard>
              ))}
            </div>
          </fieldset>

        </div>
      </div>

    </AdminPage>
  );
}

const ACCENT_OPTIONS: { value: Accent; label: string; desc: string; sidebar: string; surface: string; action: string }[] = [
  { value: "biru", label: "Biru", desc: "Bawaan: sidebar biru tua dengan aksen biru.", sidebar: "#2a45b0", surface: "#f6f8fd", action: "#2f4fc4" },
  { value: "hitam", label: "Hitam", desc: "Netral: sidebar hitam dengan aksen hitam.", sidebar: "#171717", surface: "#fafafa", action: "#111111" },
  { value: "hijau", label: "Hijau", desc: "Sidebar hijau tua dengan aksen hijau.", sidebar: "#14532d", surface: "#fafaf7", action: "#047a43" },
];

const SIZE_OPTIONS: { value: FontSize; label: string; px: string; sample: string }[] = [
  { value: "kecil", label: "Kecil", px: "15 px", sample: "0.9375rem" },
  { value: "normal", label: "Normal", px: "16 px (bawaan)", sample: "1rem" },
  { value: "besar", label: "Besar", px: "18 px", sample: "1.125rem" },
  { value: "sangat-besar", label: "Sangat besar", px: "20 px", sample: "1.25rem" },
];

const SYSTEM_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const FONT_OPTIONS: { value: FontType; label: string; tag: string; desc: string; family: string }[] = [
  { value: "sn-pro", label: "SN Pro (Supernotes)", tag: "Modern & mudah dibaca", desc: "Font ramah yang dioptimalkan untuk membaca soal dan antarmuka CBT.", family: `'SN Pro', ${SYSTEM_STACK}` },
  { value: "system", label: "Sistem Default", tag: "Inter / System Sans", desc: "Font sans-serif bawaan sistem operasi (Segoe UI, Roboto, San Francisco).", family: SYSTEM_STACK },
  { value: "serif", label: "Serif", tag: "Georgia / Times", desc: "Huruf berkaki, nyaman untuk teks bacaan panjang.", family: "Georgia, 'Times New Roman', serif" },
  { value: "mono", label: "Monospace", tag: "Lebar huruf sama", desc: "Semua huruf sama lebar; berguna untuk kode dan angka.", family: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" },
];

function OptionCard({ selected, onSelect, children }: { selected: boolean; onSelect: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`cursor-pointer rounded-lg border-2 p-4 text-left transition-colors ${selected ? "border-foreground bg-accent" : "border-border bg-card hover:border-foreground/40"}`}
    >
      {children}
    </button>
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
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 p-5 hover:bg-accent transition-colors">
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-1">
          <h3 className="text-sm font-semibold text-foreground">{label}</h3>
          {badge && (
            <span className="rounded-md border border-warn/60 bg-warn/10 px-2 py-0.5 text-label font-semibold text-warn">
              {badge}
            </span>
          )}
        </div>
        <p className="text-label text-muted-foreground leading-relaxed pr-6">{desc}</p>
      </div>
      <div className="shrink-0 mt-3 sm:mt-0">
        <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} className="data-[state=checked]:bg-primary" />
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
