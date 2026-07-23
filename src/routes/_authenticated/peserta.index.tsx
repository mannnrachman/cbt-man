import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarClock, CalendarX, Clock, FileText, ArrowRight, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableHeader,
	TableBody,
	TableHead,
	TableRow,
	TableCell,
} from "@/components/ui/table";
import { isParticipantAssignedToExam } from "@/lib/cbt/access";
import { useAuthStore } from "@/lib/cbt/auth-store";
import { getExamAvailabilityStatus } from "@/lib/cbt/availability";
import { sesiRepo, ujianRepo } from "@/lib/cbt/repos";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { RichView } from "@/components/cbt/RichEditor";


export const Route = createFileRoute("/_authenticated/peserta/")({
	component: PesertaDashboard,
});

function PesertaDashboard() {
	const user = useAuthStore((s) => s.user)!;
	const [searchQuery, setSearchQuery] = useState("");

	const sortedUjian = useMemo(() => {
		const raw = ujianRepo.all().filter((u) => isParticipantAssignedToExam(user, u));
		const sesi = sesiRepo.all().filter((s) => s.pesertaId === user.id);

		const filtered = raw.filter((u) => u.nama.toLowerCase().includes(searchQuery.toLowerCase()));

		return filtered.sort((a, b) => {
			const sA = sesi.find((x) => x.ujianId === a.id)?.status ?? "belum";
			const sB = sesi.find((x) => x.ujianId === b.id)?.status ?? "belum";
			
			const availA = getExamAvailabilityStatus(a);
			const availB = getExamAvailabilityStatus(b);

			function getScore(u: typeof a, status: string, avail: string) {
				if (status === "selesai") return 1;
				if (status === "sedang") return 5;
				if (avail === "active" || avail === "open") return 4;
				if (avail === "upcoming") return 3;
				return 2;
			}

			const scoreA = getScore(a, sA, availA);
			const scoreB = getScore(b, sB, availB);

			if (scoreA !== scoreB) return scoreB - scoreA;

			const timeA = Number(a.beginAt || 0);
			const timeB = Number(b.beginAt || 0);
			
			if (scoreA === 3) {
				return timeA - timeB;
			}
			return timeB - timeA;
		});
	}, [user, searchQuery]);

	const sesi = sesiRepo.all().filter((s) => s.pesertaId === user.id);

	return (
		<div className="min-h-[calc(100vh-64px)] relative flex flex-col overflow-hidden z-0 transition-colors duration-300">

			<main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:py-6 lg:px-12 relative z-10 w-full max-w-7xl mx-auto h-[calc(100vh-100px)]">
				{/* Glassmorphism Main Panel */}
				<div className="w-full h-full max-h-[850px] bg-white/60 dark:bg-[#0f172a]/60 backdrop-blur-3xl border border-white/40 dark:border-white/10 rounded-3xl shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.6)] p-6 sm:p-8 lg:py-6 lg:px-10 flex flex-col gap-4 sm:gap-6 relative z-10 transition-colors duration-300 overflow-hidden">
					{/* Inner glow effect for the card */}
					<div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent dark:from-white/5 dark:to-transparent pointer-events-none rounded-3xl" />

					{/* Header Section */}
					<div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 relative z-10 animate-in fade-in slide-in-from-bottom-2 duration-700">
						<div className="space-y-1.5">
							<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-100/50 dark:bg-green-900/30 border border-green-200 dark:border-green-800/50 mb-2">
								<span className="relative flex h-2 w-2">
									<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
									<span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
								</span>
								<span className="text-xs font-bold text-green-700 dark:text-green-300 uppercase tracking-wider">Live System</span>
							</div>
							<h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight font-sans text-slate-900 dark:text-white flex items-center gap-3">
								Halo, <span className="text-primary">{user.namaLengkap}</span>
							</h1>
							<p className="text-slate-500 dark:text-slate-400 font-medium max-w-2xl">
								Selamat datang di portal ujian CBT. Berikut adalah daftar ujian yang dapat Anda akses.
							</p>
						</div>
						<span className="rounded-2xl bg-white/80 dark:bg-black/40 shadow-sm border border-slate-200/50 dark:border-white/10 px-4 py-2 text-sm font-bold text-slate-700 dark:text-white backdrop-blur-md self-start sm:self-end">
							Total: {sortedUjian.length} Ujian
						</span>
					</div>

					{/* Search */}
					<div className="flex flex-col sm:flex-row justify-end gap-4 relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
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

					{/* Table Section (Responsive Height) - Exact same UI structure as Login page */}
					<div className="border border-white/50 dark:border-white/10 rounded-2xl bg-white/40 dark:bg-black/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] backdrop-blur-md relative z-10 overflow-y-auto overflow-x-auto flex-1 custom-scrollbar animate-in fade-in slide-in-from-bottom-6 duration-700">
						<Table>
							<TableHeader className="bg-white/60 dark:bg-white/5 border-b border-slate-200/50 dark:border-white/10 sticky top-0 z-20 backdrop-blur-md">
								<TableRow className="hover:bg-transparent border-none">
									<TableHead className="w-16 text-center font-sans font-extrabold text-xs uppercase tracking-wider py-4 text-slate-500 dark:text-slate-400">
										No
									</TableHead>
									<TableHead className="font-sans font-extrabold text-xs uppercase tracking-wider py-4 text-slate-500 dark:text-slate-400 min-w-[200px]">
										Nama Ujian
									</TableHead>
									<TableHead className="font-sans font-extrabold text-xs uppercase tracking-wider py-4 text-slate-500 dark:text-slate-400">
										Durasi
									</TableHead>
									<TableHead className="font-sans font-extrabold text-xs uppercase tracking-wider py-4 text-slate-500 dark:text-slate-400">
										Soal
									</TableHead>
									<TableHead className="text-right font-sans font-extrabold text-xs uppercase tracking-wider py-4 pr-6 text-slate-500 dark:text-slate-400">
										Aksi
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{sortedUjian.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={5}
											className="p-12 text-center text-slate-500 dark:text-slate-400 font-medium h-64"
										>
											<div className="flex flex-col items-center justify-center gap-3">
												<div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center">
													<CalendarX className="h-6 w-6 opacity-50" />
												</div>
												<p>Belum ada ujian untuk Anda saat ini.</p>
											</div>
										</TableCell>
									</TableRow>
								) : (
									sortedUjian.map((u, index) => {
										const s = sesi.find((x) => x.ujianId === u.id);
										const status = s?.status ?? "belum";
										const selesai = status === "selesai";
										const availability = getExamAvailabilityStatus(u);
										const isStartable = availability === "active" || availability === "open";
										const isDitutup = availability === "ended" && !selesai;

										return (
											<TableRow
												key={u.id}
												className="transition-colors border-b border-slate-200/50 dark:border-white/5 group"
											>
												<TableCell className="text-center font-bold text-slate-400 dark:text-slate-500 py-4">
													{String(index + 1).padStart(2, '0')}
												</TableCell>
												<TableCell className="py-4">
													<div className="flex items-center gap-3">
														<div className={cn(
															"p-2 rounded-lg shrink-0 border",
															selesai ? "bg-emerald-50 border-emerald-100 text-emerald-600 dark:bg-emerald-950/30 dark:border-emerald-900/50 dark:text-emerald-500" :
															isStartable ? "bg-[#03A559]/10 border-[#03A559]/20 text-[#03A559] dark:bg-green-500/20 dark:text-green-400 shadow-[0_0_10px_rgba(3,165,89,0.2)]" :
															"bg-slate-100 border-slate-200 text-slate-500 dark:bg-white/5 dark:border-white/5 dark:text-slate-400"
														)}>
															<FileText className="h-5 w-5" />
														</div>
														<div>
															<p className="font-bold text-slate-800 dark:text-slate-100">{u.nama}</p>
												{u.deskripsi ? <RichView html={u.deskripsi} className="text-xs text-slate-500" /> : null}

															{/* Timestamps */}
															{(availability === "upcoming" || availability === "ended") && (
																<div className="flex items-center gap-1.5 pt-0.5 text-xs font-semibold">
																	{availability === "upcoming" ? (
																		<span suppressHydrationWarning className="text-amber-600 dark:text-amber-500 flex items-center gap-1">

																			<CalendarClock className="h-3 w-3" />
																			Dibuka: {u.beginAt ? new Date(Number(u.beginAt)).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" }) : "Menunggu jadwal"}
																		</span>
																	) : (
																		<span className="text-red-600 dark:text-red-500 flex items-center gap-1">
																			<CalendarX className="h-3 w-3" />
																			Telah Ditutup
																		</span>
																	)}
																</div>
															)}
														</div>
													</div>
												</TableCell>
												<TableCell className="text-slate-600 dark:text-slate-300 font-bold text-sm py-4">
													<span className="flex items-center gap-1.5">
														<Clock className="h-4 w-4 text-blue-500" />
														{u.durasiMenit} menit
													</span>
												</TableCell>
												<TableCell className="text-slate-600 dark:text-slate-300 font-bold text-sm py-4">
													<span className="inline-flex items-center gap-1.5 rounded-md bg-white/60 dark:bg-black/30 px-2.5 py-1 text-xs shadow-sm border border-slate-200/50 dark:border-white/5">
														<Sparkles className="h-3.5 w-3.5 text-[#03A559]" />
														{u.topicSets.reduce((a, b) => a + b.jumlah, 0)} Soal
													</span>
												</TableCell>
												<TableCell className="text-right pr-6 py-4">
													{selesai ? (
														<Button asChild variant="outline" size="sm" className="font-bold shadow-sm hover:shadow-md transition-all group bg-white/50 dark:bg-black/20 backdrop-blur-sm border-slate-200 dark:border-white/10">
															<Link to="/peserta/ujian/$id/hasil" params={{ id: u.id }} className="flex items-center justify-center gap-1.5">
																Lihat Hasil <ArrowRight className="h-3.5 w-3.5 opacity-70 group-hover:translate-x-0.5 transition-transform" />
															</Link>
														</Button>
													) : isStartable ? (
														<div className="relative inline-block group">
															<div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-emerald-500 rounded-lg blur opacity-20 group-hover:opacity-40 transition duration-300" />
															<Button asChild size="sm" className="relative font-bold shadow-md transition-all group bg-[#03A559] hover:bg-[#028b4a] text-white">
																<Link to="/peserta/ujian/$id" params={{ id: u.id }} className="flex items-center justify-center gap-1.5">
																	{status === "sedang" ? "Lanjutkan" : "Mulai"} 
																	<ArrowRight className="h-3.5 w-3.5 opacity-70 group-hover:translate-x-1 transition-transform duration-300" />
																</Link>
															</Button>
														</div>
													) : (
														<Button variant="secondary" size="sm" disabled className="font-semibold bg-slate-100/50 dark:bg-white/5">
															Terkunci
														</Button>
													)}
												</TableCell>
											</TableRow>
										);
									})
								)}
							</TableBody>
						</Table>
					</div>

				</div>
			</main>
		</div>
	);
}
