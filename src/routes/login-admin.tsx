import { createFileRoute, redirect, Link, useNavigate } from "@tanstack/react-router";
import { validateSessionServer } from "@/lib/server/auth/functions";
import { useState, useEffect } from "react";
import { useAuthStore } from "@/lib/cbt/auth-store";
import { loadPublicBootConfig } from "@/lib/cbt/repos";
import { toast } from "sonner";
import { Sparkles, Lock, User, ArrowRight, ShieldCheck, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login-admin")({
	beforeLoad: async () => {
		const { user } = await validateSessionServer();
		if (user) {
			throw redirect({ to: user.role === "mahasiswa" ? "/peserta" : "/admin" });
		}
	},
	component: LoginAdminPage,
});

function LoginAdminPage() {
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [busy, setBusy] = useState(false);
	const [appName, setAppName] = useState("CBT-Kampus");
	const [appLogo, setAppLogo] = useState("");
	
	const login = useAuthStore((s) => s.login);
	const navigate = useNavigate();

	useEffect(() => {
		let active = true;
		void loadPublicBootConfig()
			.then((config) => {
				if (!active) return;
				if (config.appName) setAppName(config.appName);
				if (config.appLogo) setAppLogo(config.appLogo);
			})
			.catch(() => undefined);
		return () => { active = false; };
	}, []);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setBusy(true);
		try {
			const res = await login(username.trim(), password);
			if (!res.ok) {
				toast.error(res.error ?? "Kredensial tidak valid");
				setBusy(false);
				return;
			}
			
			if (res.role === "mahasiswa") {
				await useAuthStore.getState().logout();
				toast.error("Akses Ditolak: Laman ini khusus untuk Staf/Admin.");
				setBusy(false);
				return;
			}
			
			toast.success("Otorisasi berhasil. Memuat dasbor staf...");
			// Give a tiny delay for the toast to be readable before redirect
			setTimeout(() => {
				navigate({ to: "/admin" });
			}, 500);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Terjadi kesalahan sistem");
			setBusy(false);
		}
	}

	return (
		<div className="min-h-screen relative flex flex-col items-center justify-center bg-slate-50 dark:bg-[#030712] overflow-hidden z-0 px-4 transition-colors duration-300">
			{/* Modern Premium Aurora/Mesh Background */}
			<div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
				<div className="absolute -top-[40%] -left-[20%] w-[70%] h-[70%] rounded-full bg-gradient-to-br from-green-500/20 to-emerald-600/20 dark:from-green-600/20 dark:to-emerald-800/20 blur-[120px]" />
				<div className="absolute top-[20%] -right-[20%] w-[60%] h-[60%] rounded-full bg-gradient-to-bl from-blue-400/20 to-cyan-300/20 dark:from-blue-700/20 dark:to-cyan-900/20 blur-[100px]" />
				<div className="absolute -bottom-[30%] left-[10%] w-[80%] h-[80%] rounded-full bg-gradient-to-tr from-yellow-500/20 to-amber-500/20 dark:from-yellow-700/20 dark:to-amber-900/20 blur-[150px]" />
			</div>

			<Link to="/" className="absolute top-6 left-6 flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors z-20 bg-white/50 dark:bg-black/20 backdrop-blur-md px-4 py-2 rounded-full border border-slate-200/50 dark:border-white/10 shadow-sm">
				<ArrowLeft className="h-4 w-4" /> Kembali ke Depan
			</Link>

			<div className="w-full max-w-md relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
				{/* Glassmorphism Card */}
				<div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-3xl border border-white/50 dark:border-white/10 rounded-3xl shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.6)] p-8 sm:p-10 relative overflow-hidden">
					
					{/* Inner glow */}
					<div className="absolute inset-0 bg-gradient-to-b from-white/50 to-transparent dark:from-white/5 dark:to-transparent pointer-events-none rounded-3xl" />
					
					{/* Header */}
					<div className="flex flex-col items-center mb-8 relative z-10">
						<div className="h-16 w-16 bg-gradient-to-br from-[#03A559] to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30 mb-6 border border-white/20">
							<ShieldCheck className="h-8 w-8 text-white" />
						</div>
						<h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-2 text-center">
							Otorisasi Staf
						</h1>
						<p className="text-sm font-medium text-slate-500 dark:text-slate-400 text-center">
							Masuk sebagai Administrator atau Evaluator ke portal {appName}.
						</p>
					</div>

					{/* Form */}
					<form onSubmit={onSubmit} className="space-y-6 relative z-10">
						<div className="space-y-4">
							<div className="space-y-1.5 group">
								<Label htmlFor="admin-u" className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest group-focus-within:text-green-600 dark:group-focus-within:text-green-400 transition-colors">Username Staf</Label>
								<div className="relative">
									<div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
										<User className="h-4 w-4 text-slate-400 group-focus-within:text-[#03A559] transition-colors" />
									</div>
									<Input
										id="admin-u"
										autoFocus
										value={username}
										onChange={(e) => setUsername(e.target.value)}
										placeholder="admin_utama"
										autoComplete="username"
										autoCapitalize="none"
										autoCorrect="off"
										spellCheck={false}
										className="pl-10 h-12 bg-white/50 dark:bg-black/20 border-slate-200/50 dark:border-white/10 rounded-xl focus-visible:ring-[#03A559] focus-visible:border-[#03A559] transition-all font-medium placeholder:text-slate-400 shadow-inner"
										required
									/>
								</div>
							</div>
							
							<div className="space-y-1.5 group">
								<Label htmlFor="admin-p" className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest group-focus-within:text-green-600 dark:group-focus-within:text-green-400 transition-colors">Kata Sandi</Label>
								<div className="relative">
									<div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
										<Lock className="h-4 w-4 text-slate-400 group-focus-within:text-[#03A559] transition-colors" />
									</div>
									<Input
										id="admin-p"
										type="password"
										value={password}
										onChange={(e) => setPassword(e.target.value)}
										placeholder="••••••••"
										autoComplete="current-password"
										className="pl-10 h-12 bg-white/50 dark:bg-black/20 border-slate-200/50 dark:border-white/10 rounded-xl focus-visible:ring-[#03A559] focus-visible:border-[#03A559] transition-all font-medium placeholder:text-slate-400 tracking-widest shadow-inner"
										required
									/>
								</div>
							</div>
						</div>

						<Button 
							type="submit" 
							className="w-full h-12 rounded-xl bg-[#03A559] hover:bg-[#028b4a] text-white font-bold transition-all shadow-md shadow-emerald-500/25 border border-emerald-600/50 relative overflow-hidden group" 
							disabled={busy}
						>
							{/* Shine effect */}
							<div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent z-0" />
							
							{busy ? (
								<span className="relative z-10 flex items-center justify-center gap-2">
									<span className="h-4 w-4 rounded-full border-2 border-white/80 border-t-transparent animate-spin" />
									Otentikasi...
								</span>
							) : (
								<span className="relative z-10 flex items-center justify-center gap-2">
									Masuk ke Panel Staf
									<ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
								</span>
							)}
						</Button>
					</form>
					
					{/* Demo Accounts List (For Development Only) */}
					<div className="mt-8 pt-6 border-t border-slate-200/50 dark:border-white/10">
						<p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 text-center">Kredensial Demo</p>
						<div className="grid grid-cols-2 gap-3">
							<div className="bg-slate-50/50 dark:bg-black/20 p-2.5 rounded-lg border border-slate-200/50 dark:border-white/5 flex flex-col gap-1 items-center">
								<span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Admin Utama</span>
								<code className="text-[10px] bg-white dark:bg-slate-800 px-2 py-0.5 rounded text-[#03A559] dark:text-green-400 shadow-sm border border-slate-100 dark:border-white/5">admin / admin123</code>
							</div>
							<div className="bg-slate-50/50 dark:bg-black/20 p-2.5 rounded-lg border border-slate-200/50 dark:border-white/5 flex flex-col gap-1 items-center">
								<span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Evaluator</span>
								<code className="text-[10px] bg-white dark:bg-slate-800 px-2 py-0.5 rounded text-[#03A559] dark:text-green-400 shadow-sm border border-slate-100 dark:border-white/5">evaluator1 / evaluator123</code>
							</div>
						</div>
					</div>

				</div>
			</div>
		</div>
	);
}
