import { createFileRoute, redirect, Link, useNavigate } from "@tanstack/react-router";
import { validateSessionServer } from "@/lib/server/auth/functions";
import { useState, useEffect } from "react";
import { useAuthStore } from "@/lib/cbt/auth-store";
import { loadPublicBootConfig } from "@/lib/cbt/repos";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
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
	const [appName, setAppName] = useState("CBT-MAN");
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
				toast.error(res.error ?? "Nama pengguna atau kata sandi salah");
				setBusy(false);
				return;
			}
			
			if (res.role === "mahasiswa") {
				await useAuthStore.getState().logout();
				toast.error("Akses ditolak: laman ini khusus untuk staf dan admin.");
				setBusy(false);
				return;
			}
			
			navigate({ to: "/admin" });
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Terjadi kesalahan sistem");
			setBusy(false);
		}
	}

	return (
		<div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4">
			<Link
				to="/"
				className="absolute left-4 top-4 inline-flex h-10 items-center gap-2 rounded-md px-3 text-ui font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:left-6 sm:top-6"
			>
				<ArrowLeft className="h-4 w-4" /> Kembali ke beranda
			</Link>

			<main className="w-full max-w-sm">
				<div className="mb-8 flex flex-col items-center gap-4 text-center">
					{appLogo ? (
						<img src={appLogo} alt={appName} className="h-12 max-w-[200px] object-contain" />
					) : (
						<div className="text-heading font-semibold tracking-tight text-foreground">{appName}</div>
					)}
					<div className="space-y-1">
						<h1 className="text-title font-medium tracking-tight text-foreground">Masuk sebagai staf</h1>
						<p className="text-ui text-muted-foreground">Untuk administrator dan evaluator {appName}.</p>
					</div>
				</div>

				<form onSubmit={onSubmit} className="space-y-5 rounded-lg border bg-card p-6 sm:p-8">
					<div className="space-y-2">
						<Label htmlFor="admin-u">Nama pengguna</Label>
						<Input
							id="admin-u"
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
						<Label htmlFor="admin-p">Kata sandi</Label>
						<Input
							id="admin-p"
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
				</form>

				{/* Development only: shown by `npm run dev`, never in a production build. */}
				{import.meta.env.DEV && (
					<dl className="mt-6 space-y-1 text-label text-muted-foreground">
						<div className="flex justify-between gap-4">
							<dt>Admin utama</dt>
							<dd className="font-mono text-foreground">admin / admin123</dd>
						</div>
						<div className="flex justify-between gap-4">
							<dt>Evaluator</dt>
							<dd className="font-mono text-foreground">evaluator1 / evaluator123</dd>
						</div>
					</dl>
				)}
			</main>
		</div>
	);
}
