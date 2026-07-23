import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { validateSessionServer } from "@/lib/server/auth/functions";
import { loadPublicBootConfig } from "@/lib/cbt/repos";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableHeader,
	TableBody,
	TableHead,
	TableRow,
	TableCell,
} from "@/components/ui/table";
import {
	CalendarDays,
	Clock,
	GraduationCap,
	Timer,
	Sun,
	Moon,
	Globe,
	Monitor,
	Sparkles,
	Search,
} from "lucide-react";
import { useEffect, useState } from "react";
import { LoginModal } from "@/components/LoginModal";
import type { Ujian } from "@/lib/cbt/types";

type SearchParams = {
	login?: boolean;
	redirect?: string;
};

function getExamStatus(beginAt: number | undefined, endAt: number | undefined, now: number) {
	if (!beginAt || !endAt) return { text: "Belum Ditentukan", color: "text-slate-500" };

	if (now > endAt) {
		return {
			text: "Ujian Sudah Berlalu",
			color:
				"bg-red-500/10 text-red-600 dark:text-red-400 border-red-200/50 dark:border-red-900/30",
		};
	} else if (now >= beginAt && now <= endAt) {
		return {
			text: "Ujian Sedang Berlangsung",
			color:
				"bg-green-500/10 text-green-600 dark:text-green-400 border-green-200/50 dark:border-green-900/30",
		};
	} else {
		return {
			text: "Ujian Akan Berlangsung",
			color:
				"bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200/50 dark:border-amber-900/30",
		};
	}
}

function getExamCountdown(beginAt: number | undefined, endAt: number | undefined, now: number) {
	if (!beginAt || !endAt) return { text: "—", color: "text-slate-400 dark:text-slate-500 font-medium" };

	if (now > endAt) {
		return {
			text: "—",
			color: "text-slate-400 dark:text-slate-500 font-medium",
		};
	} else if (now >= beginAt && now <= endAt) {
		const diffSeconds = Math.floor((endAt - now) / 1000);
		const hours = Math.floor(diffSeconds / 3600);
		const minutes = Math.floor((diffSeconds % 3600) / 60);
		const seconds = diffSeconds % 60;

		const formatted = [
			hours > 0 ? String(hours).padStart(2, "0") : null,
			String(minutes).padStart(2, "0"),
			String(seconds).padStart(2, "0"),
		]
			.filter(Boolean)
			.join(":");

		return {
			text: `${formatted} (Sisa)`,
			color:
				"text-green-600 dark:text-green-400 font-bold font-mono animate-pulse",
		};
	} else {
		const diffSeconds = Math.floor((beginAt - now) / 1000);
		const hours = Math.floor(diffSeconds / 3600);
		const minutes = Math.floor((diffSeconds % 3600) / 60);
		const seconds = diffSeconds % 60;

		const formatted = [
			hours > 0 ? String(hours).padStart(2, "0") : null,
			String(minutes).padStart(2, "0"),
			String(seconds).padStart(2, "0"),
		]
			.filter(Boolean)
			.join(":");

		return {
			text: `${formatted} (Mulai)`,
			color: "text-amber-600 dark:text-amber-400 font-bold font-mono",
		};
	}
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
		<div className="min-h-screen relative flex flex-col bg-slate-50 dark:bg-[#030712] overflow-hidden z-0 transition-colors duration-300">
			{/* Modern Premium Aurora/Mesh Background (Optimized for Performance) */}
			<div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
				<div className="absolute -top-[40%] -left-[20%] w-[70%] h-[70%] rounded-full bg-gradient-to-br from-green-500/20 to-emerald-600/20 dark:from-green-600/20 dark:to-emerald-800/20 blur-[120px]" />
				<div className="absolute top-[20%] -right-[20%] w-[60%] h-[60%] rounded-full bg-gradient-to-bl from-blue-400/20 to-cyan-300/20 dark:from-blue-700/20 dark:to-cyan-900/20 blur-[100px]" />
				<div className="absolute -bottom-[30%] left-[10%] w-[80%] h-[80%] rounded-full bg-gradient-to-tr from-yellow-500/20 to-amber-500/20 dark:from-yellow-700/20 dark:to-amber-900/20 blur-[150px]" />
			</div>



			{/* Top Bar / Header */}
			<header className="w-full bg-white/40 dark:bg-black/20 backdrop-blur-md px-6 py-4 flex items-center justify-between relative z-20 font-sans border-b border-slate-200/50 dark:border-white/5 shadow-sm transition-colors">
				<Link 
					to="/login-admin"
					className="flex items-center gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#03A559] rounded-lg transition-transform active:scale-95"
					title="Masuk (Staf/Admin)"
				>
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
				</Link>
				<div className="flex items-center gap-4">
					<span suppressHydrationWarning className="font-mono text-sm sm:text-base font-bold text-slate-700 dark:text-slate-300 bg-slate-100/50 dark:bg-white/5 px-3 py-1.5 rounded-lg border border-slate-200/50 dark:border-white/5 backdrop-blur-sm shadow-sm">
						{timeString}
					</span>
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
				</div>
			</header>

			{/* Main Content Area */}
			<main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:py-6 lg:px-12 relative z-10 w-full max-w-7xl mx-auto h-[calc(100vh-76px)]">
				
				{/* Glassmorphism Main Panel */}
				<div className="w-full h-full max-h-[850px] bg-white/60 dark:bg-[#0f172a]/60 backdrop-blur-3xl border border-white/40 dark:border-white/10 rounded-3xl shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.6)] p-6 sm:p-8 lg:py-6 lg:px-10 flex flex-col gap-4 sm:gap-6 relative z-10 transition-colors duration-300 overflow-hidden">
					
					{/* Inner glow effect for the card */}
					<div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent dark:from-white/5 dark:to-transparent pointer-events-none rounded-3xl" />

					{/* Header Section */}
					<div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 relative z-10">
						<div className="space-y-1.5">
							<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-100/50 dark:bg-green-900/30 border border-green-200 dark:border-green-800/50 mb-2">
								<span className="relative flex h-2 w-2">
									<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
									<span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
								</span>
								<span className="text-xs font-bold text-green-700 dark:text-green-300 uppercase tracking-wider">Live System</span>
							</div>
							<h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight font-sans text-slate-900 dark:text-white flex items-center gap-3">
								Jadwal Ujian Hari Ini
							</h1>
							<p className="text-slate-500 dark:text-slate-400 font-medium">Platform evaluasi akademik terintegrasi.</p>
						</div>
						<span className="rounded-2xl bg-white/80 dark:bg-black/40 shadow-sm border border-slate-200/50 dark:border-white/10 px-4 py-2 text-sm font-bold text-slate-700 dark:text-white backdrop-blur-md self-start sm:self-end">
							Total: {exams.online.length + exams.offline.length} Ujian
						</span>
					</div>

					{/* Tabs & Search */}
					<div className="flex flex-col sm:flex-row justify-between gap-4 relative z-10">
						{/* Online/Offline Tabs */}
						<div className="relative grid grid-cols-2 bg-slate-200/50 dark:bg-black/20 p-1.5 rounded-xl border border-slate-300/50 dark:border-white/5 w-full sm:w-[320px]">
							{/* Sliding Door Background */}
							<div
								className={cn(
									"absolute top-1.5 bottom-1.5 left-1.5 w-[calc(50%-6px)] bg-white dark:bg-slate-800 rounded-lg shadow-sm transition-transform duration-300 ease-out z-0",
									activeTab === "online" ? "translate-x-0" : "translate-x-full"
								)}
							/>

							<button
								className={cn(
									"relative z-10 flex items-center justify-center gap-2 px-2 py-2.5 text-sm font-bold rounded-lg transition-colors duration-300",
									activeTab === "online"
										? "text-[#03A559] dark:text-green-400"
										: "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
								)}
								onClick={() => setActiveTab("online")}
							>
								<Globe className="h-4 w-4" /> Online 
								<span className={cn(
									"px-1.5 py-0.5 rounded-md text-xs transition-colors duration-300",
									activeTab === "online" ? "bg-slate-100 dark:bg-slate-900" : "bg-white/50 dark:bg-black/10"
								)}>
									{exams.online.length}
								</span>
							</button>

							<button
								className={cn(
									"relative z-10 flex items-center justify-center gap-2 px-2 py-2.5 text-sm font-bold rounded-lg transition-colors duration-300",
									activeTab === "offline"
										? "text-[#03A559] dark:text-green-400"
										: "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
								)}
								onClick={() => setActiveTab("offline")}
							>
								<Monitor className="h-4 w-4" /> Offline
								<span className={cn(
									"px-1.5 py-0.5 rounded-md text-xs transition-colors duration-300",
									activeTab === "offline" ? "bg-slate-100 dark:bg-slate-900" : "bg-white/50 dark:bg-black/10"
								)}>
									{exams.offline.length}
								</span>
							</button>
						</div>

						{/* Search Bar */}
						<div className="relative w-full sm:max-w-xs h-[52px]">
							<Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
							<input
								type="text"
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								placeholder="Cari nama ujian..."
								className="w-full h-full pl-11 pr-4 rounded-xl border border-slate-200/50 dark:border-white/10 bg-white/50 dark:bg-black/20 focus:outline-none focus:ring-2 focus:ring-[#03A559]/50 dark:focus:ring-green-500/50 text-sm font-medium transition-all text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
							/>
						</div>
					</div>

					{/* Table Section (Responsive Height) */}
					<div className="border border-white/50 dark:border-white/10 rounded-2xl bg-white/40 dark:bg-black/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] backdrop-blur-md relative z-10 overflow-y-auto overflow-x-auto max-h-[250px] custom-scrollbar">
						<Table>
							<TableHeader className="bg-white/60 dark:bg-white/5 border-b border-slate-200/50 dark:border-white/10">
								<TableRow className="hover:bg-transparent border-none">
									<TableHead className="w-16 text-center font-sans font-extrabold text-xs uppercase tracking-wider py-4 text-slate-500 dark:text-slate-400">
										No
									</TableHead>
									<TableHead className="font-sans font-extrabold text-xs uppercase tracking-wider py-4 text-slate-500 dark:text-slate-400">
										Nama Ujian
									</TableHead>
									<TableHead className="font-sans font-extrabold text-xs uppercase tracking-wider py-4 text-slate-500 dark:text-slate-400">
										Program Studi
									</TableHead>
									<TableHead className="font-sans font-extrabold text-xs uppercase tracking-wider py-4 text-slate-500 dark:text-slate-400">
										Waktu
									</TableHead>
									<TableHead className="text-center font-sans font-extrabold text-xs uppercase tracking-wider py-4 text-slate-500 dark:text-slate-400">
										Durasi
									</TableHead>
									<TableHead className="text-center font-sans font-extrabold text-xs uppercase tracking-wider py-4 text-slate-500 dark:text-slate-400">
										Countdown
									</TableHead>
									<TableHead className="text-right font-sans font-extrabold text-xs uppercase tracking-wider py-4 pr-6 text-slate-500 dark:text-slate-400">
										Status
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{currentExams.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={7}
											className="p-12 text-center text-slate-500 dark:text-slate-400 font-medium"
										>
											<div className="flex flex-col items-center gap-3">
												<div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center">
													<CalendarDays className="h-6 w-6 opacity-50" />
												</div>
												<p>Tidak ada ujian {activeTab === "online" ? "online" : "offline"} yang dijadwalkan hari ini.</p>
											</div>
										</TableCell>
									</TableRow>
								) : (
									currentExams.map((exam, index) => (
										<TableRow
											key={exam.id}
											className="transition-colors border-b border-slate-200/50 dark:border-white/5 group"
										>
											<TableCell className="text-center font-bold text-slate-400 dark:text-slate-500 py-4">
												{String(index + 1).padStart(2, '0')}
											</TableCell>
											<TableCell className="font-bold text-slate-800 dark:text-slate-100 py-4 transition-colors">
												{exam.nama}
											</TableCell>
											<TableCell className="py-4">
												<span className="inline-flex items-center gap-1.5 rounded-md bg-white/60 dark:bg-black/30 px-2.5 py-1 text-xs font-bold text-slate-600 dark:text-slate-300 shadow-sm border border-slate-200/50 dark:border-white/5">
													<GraduationCap className="h-3.5 w-3.5 text-[#03A559]" />
													{exam.groupIds[0] && groupsMap[exam.groupIds[0]] ? groupsMap[exam.groupIds[0]] : "—"}
												</span>
											</TableCell>
											<TableCell className="text-slate-600 dark:text-slate-300 font-bold text-sm py-4">
												<span className="flex items-center gap-2">

													<Clock className="h-4 w-4 text-blue-500" />
													{exam.beginAt
														? new Date(Number(exam.beginAt)).toLocaleTimeString(
																"id-ID",
																{ hour: "2-digit", minute: "2-digit" },
															)
														: "—"}{" "}
													—
													{exam.endAt
														? new Date(Number(exam.endAt)).toLocaleTimeString(
																"id-ID",
																{ hour: "2-digit", minute: "2-digit" },
															)
														: "—"}
												</span>
											</TableCell>
											<TableCell className="text-center py-4">
												<span className="inline-flex items-center gap-1.5 bg-green-50 dark:bg-green-500/10 px-2.5 py-1 rounded-md text-green-600 dark:text-green-300 text-xs font-bold border border-green-100 dark:border-green-500/20">
													<Timer className="h-3.5 w-3.5" />
													{exam.durasiMenit} mnt
												</span>
											</TableCell>
											<TableCell className="text-center py-4">
												{(() => {
													const countdown = getExamCountdown(exam.beginAt, exam.endAt, now);
													return (
														<span className={`inline-flex items-center text-sm font-bold tracking-wider ${countdown.color}`}>
															{countdown.text}
														</span>
													);
												})()}
											</TableCell>
											<TableCell className="text-right pr-6 py-4">
												{(() => {
													const status = getExamStatus(exam.beginAt, exam.endAt, now);
													let colorClasses = "";
													if (status.text === "Ujian Sudah Berlalu") {
														colorClasses =
															"bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20";
													} else if (
														status.text === "Ujian Sedang Berlangsung"
													) {
														colorClasses =
															"bg-green-50 text-green-600 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.2)]";
													} else {
														colorClasses =
															"bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20";
													}
													return (
														<span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-extrabold border whitespace-nowrap ${colorClasses}`}>
															{status.text}
														</span>
													);
												})()}
											</TableCell>
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
					</div>

					{/* Footer/Login Button Section */}
					<div className="flex justify-center pt-2 relative z-10">
						{activeTab === "online" ? (
							<div className="relative group">
								<button 
									onClick={handleOpenLoginGeneral}
									className="w-full sm:w-72 h-14 bg-[#03A559] hover:bg-[#028b4a] text-white font-semibold rounded-xl shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 border border-[#028b4a]"
								>
									Mulai Ujian Online
								</button>
							</div>
						) : (
							<div className="text-center text-sm font-medium text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-black/20 backdrop-blur-sm px-6 py-4 rounded-xl border border-slate-200/50 dark:border-white/5">
								Ujian offline dilaksanakan di ruang ujian yang ditentukan. Silakan hubungi pengawas ujian Anda.
							</div>
						)}
					</div>
				</div>
			</main>

			<LoginModal
				isOpen={!!search.login}
				onClose={handleCloseModal}
				redirectUrl={search.redirect}
			/>
		</div>
	);
}
