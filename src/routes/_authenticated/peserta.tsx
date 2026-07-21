import {
	createFileRoute,
	Outlet,
	redirect,
	useNavigate,
	useLocation,
} from "@tanstack/react-router";
import { LogOut, Sparkles, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/cbt/auth-store";
import { configRepo, hydrateRepos } from "@/lib/cbt/repos";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/_authenticated/peserta")({
	beforeLoad: async ({ context }) => {
		const user = (context as { user: { role: string } }).user;
		if (user.role !== "mahasiswa") throw redirect({ to: "/admin" });

		try {
			await hydrateRepos();
		} catch {
			// fallback on error
		}
	},
	component: PesertaLayout,
});

function PesertaLayout() {
	const user = useAuthStore((s) => s.user)!;
	const logout = useAuthStore((s) => s.logout);
	const navigate = useNavigate();
	const appLogo = configRepo.get().appLogo;
	const appName = configRepo.get().appName;

	const location = useLocation();
	const isKerjakan = location.pathname.endsWith("/kerjakan");

	const [theme, setTheme] = useState<"light" | "dark">("light");

	useEffect(() => {
		const stored = localStorage.getItem("theme");
		if (stored === "dark" || stored === "light") {
			setTheme(stored);
			if (stored === "dark") document.documentElement.classList.add("dark");
			else document.documentElement.classList.remove("dark");
		} else {
			const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
			setTheme(prefersDark ? "dark" : "light");
			if (prefersDark) document.documentElement.classList.add("dark");
			else document.documentElement.classList.remove("dark");
		}
	}, []);

	const toggleTheme = () => {
		const nextTheme = theme === "light" ? "dark" : "light";
		setTheme(nextTheme);
		localStorage.setItem("theme", nextTheme);
		if (nextTheme === "dark") document.documentElement.classList.add("dark");
		else document.documentElement.classList.remove("dark");
	};

	return (
		<div className={cn("relative flex flex-col bg-slate-50 dark:bg-[#030712] overflow-hidden z-0 transition-colors duration-300", isKerjakan ? "h-screen" : "min-h-screen")}>
			
			{/* Modern Premium Aurora/Mesh Background - Hidden when in exam engine */}
			{!isKerjakan && (
				<div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
					<div className="absolute -top-[40%] -left-[20%] w-[70%] h-[70%] rounded-full bg-gradient-to-br from-green-500/20 to-emerald-600/20 dark:from-green-600/20 dark:to-emerald-800/20 blur-[120px]" />
					<div className="absolute top-[20%] -right-[20%] w-[60%] h-[60%] rounded-full bg-gradient-to-bl from-blue-400/20 to-cyan-300/20 dark:from-blue-700/20 dark:to-cyan-900/20 blur-[100px]" />
					<div className="absolute -bottom-[30%] left-[10%] w-[80%] h-[80%] rounded-full bg-gradient-to-tr from-yellow-500/20 to-amber-500/20 dark:from-yellow-700/20 dark:to-amber-900/20 blur-[150px]" />
				</div>
			)}

			<header className="w-full bg-white/40 dark:bg-black/20 backdrop-blur-md px-6 py-4 flex items-center justify-between relative z-20 font-sans border-b border-slate-200/50 dark:border-white/5 shadow-sm transition-colors shrink-0">
				<div className="flex items-center gap-3">
					{appLogo ? (
						<img src={appLogo} alt="Logo" className="h-8 max-w-[120px] object-contain drop-shadow-sm" />
					) : (
						<div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#03A559] to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
							<Sparkles className="h-4 w-4 text-white" />
						</div>
					)}
					<span className="font-extrabold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300">
						{appName}
					</span>
				</div>
				<div className="flex items-center gap-3 sm:gap-4">
					<div className="text-right hidden sm:block mr-2">
						<div className="font-bold text-sm text-slate-800 dark:text-slate-200 leading-tight">{user.namaLengkap}</div>
						<div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 tracking-wider uppercase">Portal Peserta</div>
					</div>

					<Button
						variant="outline"
						size="icon"
						onClick={toggleTheme}
						className="h-9 w-9 rounded-xl bg-white/50 dark:bg-black/50 backdrop-blur-sm border-slate-200 dark:border-white/10 hover:bg-white dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 transition-all shadow-sm"
						aria-label="Toggle Theme"
					>
						{theme === "dark" ? (
							<Sun className="h-4 w-4 text-amber-400" />
						) : (
							<Moon className="h-4 w-4 text-[#03A559]" />
						)}
					</Button>
					
					<Button 
						variant="outline"
						size="icon"
						className="h-9 w-9 rounded-xl bg-white/50 dark:bg-black/50 backdrop-blur-sm border-slate-200 dark:border-white/10 hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-500/20 dark:hover:text-red-400 transition-all shadow-sm text-slate-600 dark:text-slate-300"
						title="Keluar"
						onClick={async () => {
							if (isKerjakan) {
								if (!confirm("Keluar dari ujian? Waktu akan terus berjalan.")) return;
							}
							await logout();
							navigate({ to: "/login" });
						}}
					>
						<LogOut className="h-4 w-4" />
					</Button>
				</div>
			</header>
			<main className="flex-1 w-full flex flex-col min-h-0 relative z-10">
				<Outlet />
			</main>
		</div>
	);
}
