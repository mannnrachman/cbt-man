import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { configRepo, hydrateRepos } from "@/lib/cbt/repos";
import { ConfigSchema } from "@/lib/cbt/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Settings } from "lucide-react";
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

  function save() {
    const parsed = ConfigSchema.safeParse(cfg);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Konfigurasi tidak valid");
      return;
    }
    configRepo.set(parsed.data);
    toast.success("Pengaturan disimpan.");
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link to="/admin" className="text-sm text-muted-foreground hover:underline">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" /> Pengaturan
        </h1>
        <p className="text-sm text-muted-foreground">Identitas aplikasi & kebijakan ujian.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Identitas Aplikasi</CardTitle>
          <CardDescription>
            Nama dan deskripsi yang ditampilkan di header dan login.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Nama aplikasi</Label>
            <Input
              value={cfg.appName}
              onChange={(e) => setCfg({ ...cfg, appName: e.target.value })}
            />
          </div>
          <div>
            <Label>Deskripsi</Label>
            <Textarea
              value={cfg.appDeskripsi}
              onChange={(e) => setCfg({ ...cfg, appDeskripsi: e.target.value })}
            />
          </div>
          <div>
            <Label>Pesan di halaman login</Label>
            <Textarea
              value={cfg.pesanLogin}
              onChange={(e) => setCfg({ ...cfg, pesanLogin: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kebijakan Ujian</CardTitle>
          <CardDescription>Pengaturan default untuk perangkat & sesi.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ToggleRow
            label="Kunci akses dari perangkat mobile"
            desc="Tolak peserta yang membuka aplikasi dari layar kecil."
            checked={cfg.mobileLock}
            onChange={(v) => setCfg({ ...cfg, mobileLock: v })}
          />
          <ToggleRow
            label="Izinkan multi-device"
            desc="Peserta boleh melanjutkan sesi yang sama di perangkat lain."
            checked={cfg.multiDevice}
            onChange={(v) => setCfg({ ...cfg, multiDevice: v })}
          />
        </CardContent>
      </Card>

      <Button onClick={save}>Simpan pengaturan</Button>
    </div>
  );
}

function ToggleRow({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded border p-3">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
