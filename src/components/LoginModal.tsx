import { useState, useEffect } from "react";
import { loadPublicBootConfig } from "@/lib/cbt/repos";
import { useAuthStore } from "@/lib/cbt/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  redirectUrl?: string;
}

export function LoginModal({ isOpen, onClose, redirectUrl }: LoginModalProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [appName, setAppName] = useState("CBT-MAN");
  const [appLogo, setAppLogo] = useState("");
  const [pesanLogin, setPesanLogin] = useState("Selamat datang di aplikasi ujian online");
  const login = useAuthStore((s) => s.login);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    void loadPublicBootConfig()
      .then((config) => {
        if (!active) return;
        setAppName(config.appName);
        setAppLogo(config.appLogo ?? "");
        setPesanLogin(config.pesanLogin);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [isOpen]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await login(username.trim(), password);
      if (!res.ok) {
        toast.error(res.error ?? "Nama pengguna atau kata sandi salah");
        return;
      }
      if (res.role !== "mahasiswa") {
        await useAuthStore.getState().logout();
        toast.error("Form ini khusus untuk peserta ujian. Akses ditolak.");
        return;
      }

            const fallback = "/peserta";
      const redirect = redirectUrl?.startsWith("/")
        ? new URL(redirectUrl, window.location.origin)
        : undefined;
      window.location.href = redirect?.origin === window.location.origin ? redirect.href : fallback;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal memuat data sesi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader className="items-center space-y-3 text-center sm:text-center">
          {appLogo ? (
            <img src={appLogo} alt={appName} className="h-12 max-w-[200px] object-contain" />
          ) : (
            <div className="text-heading font-semibold tracking-tight text-foreground">{appName}</div>
          )}
          <DialogTitle className="text-title">Masuk sebagai peserta</DialogTitle>
          <DialogDescription className="text-center">{pesanLogin}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="modal-u">Nama pengguna</Label>
            <Input
              id="modal-u"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="modal-p">Kata sandi</Label>
            <Input
              id="modal-p"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? "Memeriksa…" : "Masuk"}
          </Button>

          {/* Development only: shown by `npm run dev`, never in a production build. */}
          {import.meta.env.DEV && (
            <p className="text-label text-muted-foreground">
              Peserta demo: <span className="font-mono text-foreground">alif.mahendra / peserta123</span>
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
