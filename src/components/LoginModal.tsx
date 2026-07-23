import { useState, useEffect } from "react";
import { loadPublicBootConfig } from "@/lib/cbt/repos";
import { useAuthStore } from "@/lib/cbt/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Sparkles, Lock, User, ArrowRight, Eye, EyeOff } from "lucide-react";
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
        toast.error(res.error ?? "Gagal masuk");
        return;
      }
      if (res.role !== "mahasiswa") {
        await useAuthStore.getState().logout();
        toast.error("Form ini khusus untuk Peserta Ujian. Akses ditolak.");
        return;
      }

      toast.success("Berhasil masuk");

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
      <DialogContent className="sm:max-w-[420px] p-0 overflow-hidden border-0 bg-transparent shadow-2xl">
        <div className="relative p-6 sm:p-8 bg-white/90 dark:bg-slate-950/90 backdrop-blur-2xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] border border-white/40 dark:border-white/10 rounded-xl">
          {/* Decorative glowing orb inside modal */}
          <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 bg-green-500/20 rounded-full blur-[40px] pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-12 -mb-12 w-48 h-48 bg-yellow-500/20 rounded-full blur-[40px] pointer-events-none" />
          
          <DialogHeader className="text-center sm:text-center flex flex-col items-center relative z-10 space-y-4">
            {appLogo ? (
              <img src={appLogo} alt="Logo" className="h-16 max-w-[180px] object-contain drop-shadow-md" />
            ) : (
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-[#03A559] to-emerald-600 shadow-lg shadow-emerald-500/30">
                <Sparkles className="h-7 w-7 text-white" />
              </div>
            )}
            <div className="space-y-1.5">
              <DialogTitle className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">Masuk ke {appName}</DialogTitle>
              <DialogDescription className="text-center font-medium text-slate-500 dark:text-slate-400">{pesanLogin}</DialogDescription>
            </div>
          </DialogHeader>

          <form onSubmit={onSubmit} className="space-y-5 mt-6 relative z-10">
            <div className="space-y-4">
              <div className="space-y-1.5 group">
                <Label htmlFor="modal-u" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider group-focus-within:text-green-600 dark:group-focus-within:text-green-400 transition-colors">Username</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-slate-400 group-focus-within:text-[#03A559] transition-colors" />
                  </div>
                  <Input
                    id="modal-u"
                    autoFocus
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Masukkan username"
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className="pl-10 h-12 bg-slate-50 dark:bg-black/20 border-slate-200 dark:border-white/10 rounded-xl focus-visible:ring-[#03A559] focus-visible:border-[#03A559] transition-all font-medium placeholder:text-slate-400"
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-1.5 group">
                <Label htmlFor="modal-p" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider group-focus-within:text-green-600 dark:group-focus-within:text-green-400 transition-colors">Password</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-[#03A559] transition-colors" />
                  </div>
                  <Input
                    id="modal-p"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="pl-10 h-12 bg-slate-50 dark:bg-black/20 border-slate-200 dark:border-white/10 rounded-xl focus-visible:ring-[#03A559] focus-visible:border-[#03A559] transition-all font-medium placeholder:text-slate-400 tracking-widest"
                    required
                  />
                </div>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 rounded-xl bg-[#03A559] hover:bg-[#028b4a] text-white font-semibold transition-all border border-[#028b4a]" 
              disabled={busy}
            >
              {busy ? (
                <span className="flex items-center justify-center w-full gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Memverifikasi...
                </span>
              ) : (
                <span className="flex items-center justify-center w-full gap-2">
                  Masuk Sekarang
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </span>
              )}
            </Button>
            
            {import.meta.env.DEV && (
              <div className="mt-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 p-4 text-xs text-slate-500 dark:text-slate-400">
                <p className="font-bold text-slate-700 dark:text-slate-300 mb-1.5">Akses Demo:</p>
                <ul className="space-y-1.5 font-medium">
                  <li className="flex justify-between items-center bg-white dark:bg-black/20 px-2 py-1.5 rounded-md border border-slate-100 dark:border-white/5">
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Peserta (Demo)</span>
                    <code className="font-mono text-[11px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-green-700 dark:text-green-300">alif.mahendra / peserta123</code>
                  </li>
                </ul>
              </div>
            )}
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
