import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { validateSessionServer } from "@/lib/server/auth/functions";
import { loadPublicBootConfig } from "@/lib/cbt/repos";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge, type StatusTone } from "@/components/cbt/StatusBadge";
import {
	Table,
	TableHeader,
	TableBody,
	TableHead,
	TableRow,
	TableCell,
} from "@/components/ui/table";
import { Sun, Moon, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { LoginModal } from "@/components/LoginModal";
import type { Ujian } from "@/lib/cbt/types";

type SearchParams = {
	login?: boolean;
	redirect?: string;
};

function getExamStatus(
	beginAt: number | undefined,
	endAt: number | undefined,
	now: number,
): { text: string; tone: StatusTone } {
	if (!beginAt || !endAt) return { text: "Belum ditentukan", tone: "neutral" };
	if (now > endAt) return { text: "Sudah berlalu", tone: "neutral" };
	if (now >= beginAt) return { text: "Sedang berlangsung", tone: "active" };
	return { text: "Akan berlangsung", tone: "warn" };
}

function formatClock(totalSeconds: number) {
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	return [
		hours > 0 ? String(hours).padStart(2, "0") : null,
		String(minutes).padStart(2, "0"),
		String(seconds).padStart(2, "0"),
	]
		.filter(Boolean)
		.join(":");
}

function getExamCountdown(beginAt: number | undefined, endAt: number | undefined, now: number) {
	if (!beginAt || !endAt || now > endAt) return "—";
	if (now >= beginAt) return `Sisa ${formatClock(Math.floor((endAt - now) / 1000))}`;
	return `Mulai dalam ${formatClock(Math.floor((beginAt - now) / 1000))}`;
}

function formatTime(value: number | undefined) {
	return value
		? new Date(Number(value)).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
		: "—";
}

// Server function to get today's exams
const getTodaysExams = createServerFn({ method: "GET" })
	.validator(z.object({}))
	.handler(async () => {
		const { getTodaysExamsServer } = await import("@/lib/server/exams");
		return getTodaysExamsServer();
	});

export const Route = createFileRoute("/")({
	head: () => ({
		meta: [
			{ title: "CBT-MAN — Aplikasi Ujian Berbasis Komputer" },
			{
				name: "description",
				content:
					"Ujian online modern: bank soal, timer, anti-cheat, dan laporan dalam satu aplikasi.",
			},
		],
	}),
	validateSearch: (search: Record<string, unknown>): SearchParams => {
		return {
			login: search.login === true || search.login === "true" || undefined,
			redirect:
				typeof search.redirect === "string" ? search.redirect : undefined,
		};
	},
	beforeLoad: async () => {
		const { user } = await validateSessionServer();
		if (user) {
			throw redirect({ to: user.role === "mahasiswa" ? "/peserta" : "/admin" });
		}
	},
	loader: async () => {
		return getTodaysExams({ data: {} });
	},
	component: Landing,
});

function Landing() {
	const initialData = Route.useLoaderData();
	const { data } = useQuery({
		queryKey: ["todaysExams"],
		queryFn: () => getTodaysExams({ data: {} }),
		initialData,
		refetchInterval: 60000,
	});

	const [appLogo, setAppLogo] = useState("");
	const [appName, setAppName] = useState("CBT-MAN");
	
	useEffect(() => {
		loadPublicBootConfig().then(cfg => {
			if (cfg.appLogo) setAppLogo(cfg.appLogo);
			if (cfg.appName) setAppName(cfg.appName);
		}).catch(() => undefined);
	}, []);

	const exams = { online: data?.online ?? [], offline: data?.offline ?? [] };
	const groupsMap = data?.groupsMap ?? {};
	const serverTime = data?.serverTime ?? Date.now();

	const [activeTab, setActiveTab] = useState<"online" | "offline">("online");
	const [theme, setTheme] = useState<"light" | "dark">("light");
	
	const [timeOffset, setTimeOffset] = useState(0);
	const [now, setNow] = useState(Date.now());
	const [searchQuery, setSearchQuery] = useState("");
	
	useEffect(() => {
		if (serverTime) {
			setTimeOffset(Date.now() - serverTime);
		}
	}, [serverTime]);

	useEffect(() => {
		const updateTime = () => {
			setNow(Date.now() - timeOffset);
		};
		updateTime();
		const interval = setInterval(updateTime, 1000);
		return () => clearInterval(interval);
	}, [timeOffset]);

	const timeString = new Date(now).toLocaleTimeString("en-US", {
		hour: "numeric",
		minute: "2-digit",
		second: "2-digit",
		hour12: true,
	});

	const search = Route.useSearch();
	const navigate = Route.useNavigate();

	useEffect(() => {
		const stored = localStorage.getItem("theme");
		if (stored === "dark" || stored === "light") {
			setTheme(stored);
			if (stored === "dark") {
				document.documentElement.classList.add("dark");
			} else {
				document.documentElement.classList.remove("dark");
			}
		} else {
			const prefersDark = window.matchMedia(
				"(prefers-color-scheme: dark)",
			).matches;
			setTheme(prefersDark ? "dark" : "light");
			if (prefersDark) {
				document.documentElement.classList.add("dark");
			} else {
				document.documentElement.classList.remove("dark");
			}
		}
	}, []);

	const toggleTheme = () => {
		const nextTheme = theme === "light" ? "dark" : "light";
		setTheme(nextTheme);
		localStorage.setItem("theme", nextTheme);
		if (nextTheme === "dark") {
			document.documentElement.classList.add("dark");
		} else {
			document.documentElement.classList.remove("dark");
		}
	};

	const handleCloseModal = () => {
		navigate({
			to: "/",
			search: (prev) => {
				const next = { ...prev };
				delete next.login;
				delete next.redirect;
				return next;
			},
			replace: true,
		});
	};

	const handleOpenLogin = (ujianId: string) => {
		navigate({
			to: "/",
			search: (prev) => ({
				...prev,
				login: true,
				redirect: `/peserta/ujian/${ujianId}`,
			}),
		});
	};

	const handleOpenLoginGeneral = () => {
		navigate({
			to: "/",
			search: (prev) => ({
				...prev,
				login: true,
			}),
		});
	};

	const rawCurrentExams = activeTab === "online" ? exams.online : exams.offline;
	const currentExams = rawCurrentExams.filter((exam) => 
		exam.nama.toLowerCase().includes(searchQuery.toLowerCase())
	);

	return (
		<div className="flex min-h-screen flex-col bg-background">
			<header className="flex h-16 items-center justify-between border-b bg-card px-4 sm:px-6">
				<Link
					to="/login-admin"
					className="flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					title="Masuk sebagai staf"
				>
					{appLogo ? (
						<img src={appLogo} alt="" className="h-8 max-w-[120px] object-contain" />
					) : null}
					<span className="text-heading font-semibold tracking-tight text-foreground">{appName}</span>
				</Link>
				<div className="flex items-center gap-3">
					<span suppressHydrationWarning className="hidden font-mono text-ui sm:inline tabular-nums text-foreground">
						{timeString}
					</span>
					<Button
						variant="outline"
						size="icon"
						onClick={toggleTheme}
						aria-label={theme === "dark" ? "Pakai tema terang" : "Pakai tema gelap"}
					>
						{theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
					</Button>
					<Button type="button" onClick={handleOpenLoginGeneral}>
						Login Peserta
					</Button>
				</div>
			</header>

			<main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8 sm:px-6">
				<div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-end">
					<h1 className="text-title font-medium tracking-tight text-foreground">Jadwal ujian hari ini</h1>
					<p className="text-ui text-muted-foreground">
						{exams.online.length + exams.offline.length} ujian terjadwal
					</p>
				</div>

				<div className="flex flex-col justify-between gap-4 sm:flex-row">
					<div role="tablist" aria-label="Jenis ujian" className="inline-flex w-full rounded-lg bg-muted p-1 sm:w-auto">
						{(["online", "offline"] as const).map((tab) => (
							<button
								key={tab}
								type="button"
								role="tab"
								aria-selected={activeTab === tab}
								onClick={() => setActiveTab(tab)}
								className={cn(
									"inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-md px-4 text-ui font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-none",
									activeTab === tab
										? "border border-foreground/20 bg-card text-foreground"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								{tab === "online" ? "Online" : "Offline"}
								<span className="tabular-nums text-muted-foreground">{exams[tab].length}</span>
							</button>
						))}
					</div>

					<div className="relative w-full sm:max-w-xs">
						<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							type="search"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Cari nama ujian"
							aria-label="Cari nama ujian"
							className="pl-9"
						/>
					</div>
				</div>

				<div className="overflow-x-auto rounded-lg border bg-card">
					<Table>
						<TableHeader>
							<TableRow className="hover:bg-transparent">
								<TableHead className="w-16 text-center">No</TableHead>
								<TableHead>Nama ujian</TableHead>
								<TableHead>Program studi</TableHead>
								<TableHead>Waktu</TableHead>
								<TableHead>Durasi</TableHead>
								<TableHead>Hitung mundur</TableHead>
								<TableHead>Status</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{currentExams.length === 0 ? (
								<TableRow className="hover:bg-transparent">
									<TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
										{searchQuery
											? "Tidak ada ujian yang cocok dengan pencarian."
											: `Tidak ada ujian ${activeTab} yang dijadwalkan hari ini.`}
									</TableCell>
								</TableRow>
							) : (
								currentExams.map((exam, index) => {
									const status = getExamStatus(exam.beginAt, exam.endAt, now);
									return (
										<TableRow key={exam.id}>
											<TableCell className="text-center tabular-nums text-muted-foreground">
												{String(index + 1).padStart(2, "0")}
											</TableCell>
											<TableCell className="font-medium text-foreground">{exam.nama}</TableCell>
											<TableCell className="text-muted-foreground">
												{exam.groupIds[0] && groupsMap[exam.groupIds[0]] ? groupsMap[exam.groupIds[0]] : "—"}
											</TableCell>
											<TableCell className="whitespace-nowrap tabular-nums">
												{formatTime(exam.beginAt)} – {formatTime(exam.endAt)}
											</TableCell>
											<TableCell className="whitespace-nowrap tabular-nums">{exam.durasiMenit} menit</TableCell>
											<TableCell className="whitespace-nowrap font-mono tabular-nums">
												{getExamCountdown(exam.beginAt, exam.endAt, now)}
											</TableCell>
											<TableCell>
												<StatusBadge tone={status.tone}>{status.text}</StatusBadge>
											</TableCell>
										</TableRow>
									);
								})
							)}
						</TableBody>
					</Table>
				</div>

				{activeTab === "offline" && (
					<p className="text-ui text-muted-foreground">
						Ujian offline dilaksanakan di ruang ujian yang ditentukan. Hubungi pengawas ujian Anda.
					</p>
				)}
			</main>

			<LoginModal
				isOpen={!!search.login}
				onClose={handleCloseModal}
				redirectUrl={search.redirect}
			/>
		</div>
	);
}
