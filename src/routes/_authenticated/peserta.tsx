import {
	createFileRoute,
	Outlet,
	redirect,
	useNavigate,
	useLocation,
} from "@tanstack/react-router";
import { LogOut, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/cbt/ConfirmDialog";
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

	const { confirm, dialog } = useConfirmDialog();

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
		<div className={cn("flex flex-col bg-background", isKerjakan ? "h-screen overflow-hidden" : "min-h-screen")}>
			<header className="flex h-16 shrink-0 items-center justify-between border-b bg-card px-4 sm:px-6">
				<div className="flex items-center gap-3">
					{appLogo ? (
						<img src={appLogo} alt="" className="h-8 max-w-[120px] object-contain" />
					) : null}
					<span className="text-heading font-semibold tracking-tight text-foreground">{appName}</span>
				</div>
				<div className="flex items-center gap-3">
					<div className="mr-2 hidden text-right sm:block">
						<div className="text-ui font-medium leading-tight text-foreground">{user.namaLengkap}</div>
						<div className="text-label text-muted-foreground">Peserta</div>
					</div>

					<Button
						variant="outline"
						size="icon"
						onClick={toggleTheme}
						aria-label={theme === "dark" ? "Pakai tema terang" : "Pakai tema gelap"}
					>
						{theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
					</Button>

					<Button
						variant="outline"
						size="icon"
						aria-label="Keluar"
						title="Keluar"
						onClick={async () => {
							if (isKerjakan) {
								const ok = await confirm({
									title: "Keluar dari ujian?",
									description: "Waktu akan terus berjalan.",
									confirmLabel: "Keluar",
									icon: <LogOut className="h-5 w-5" />,
									destructive: false,
								});
								if (!ok) return;
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
		{dialog}
		</div>
	);
}
