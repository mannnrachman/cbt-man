import { createFileRoute, Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/cbt/StatusBadge";
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
		<div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
			<div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-end">
				<div className="space-y-1">
					<h1 className="text-title font-medium tracking-tight text-foreground">Ujian untuk Anda</h1>
					<p className="text-ui text-muted-foreground">Masuk sebagai {user.namaLengkap}</p>
				</div>
				<p className="text-ui text-muted-foreground">{sortedUjian.length} ujian</p>
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

			<div className="overflow-x-auto rounded-lg border bg-card">
				<Table>
					<TableHeader>
						<TableRow className="hover:bg-transparent">
							<TableHead className="w-16 text-center">No</TableHead>
							<TableHead className="min-w-[220px]">Nama ujian</TableHead>
							<TableHead>Durasi</TableHead>
							<TableHead>Jumlah soal</TableHead>
							<TableHead>Status</TableHead>
							<TableHead className="text-right">Aksi</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{sortedUjian.length === 0 ? (
							<TableRow className="hover:bg-transparent">
								<TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
									{searchQuery ? "Tidak ada ujian yang cocok dengan pencarian." : "Belum ada ujian untuk Anda."}
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
								const opensAt = u.beginAt
									? new Date(Number(u.beginAt)).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jakarta" })
									: null;

								return (
									<TableRow key={u.id}>
										<TableCell className="text-center tabular-nums text-muted-foreground">
											{String(index + 1).padStart(2, "0")}
										</TableCell>
										<TableCell>
											<p className="font-medium text-foreground">{u.nama}</p>
											{u.deskripsi ? <RichView html={u.deskripsi} className="text-label text-muted-foreground" /> : null}
										</TableCell>
										<TableCell className="whitespace-nowrap tabular-nums">{u.durasiMenit} menit</TableCell>
										<TableCell className="whitespace-nowrap tabular-nums">
											{u.topicSets.reduce((a, b) => a + b.jumlah, 0)} soal
										</TableCell>
										<TableCell>
											{selesai ? (
												<StatusBadge tone="active">Selesai</StatusBadge>
											) : status === "sedang" ? (
												<StatusBadge tone="warn">Sedang dikerjakan</StatusBadge>
											) : isStartable ? (
												<StatusBadge tone="active">Dibuka</StatusBadge>
											) : availability === "upcoming" ? (
												<StatusBadge tone="neutral">
													<span suppressHydrationWarning>Dibuka {opensAt ?? "menunggu jadwal"}</span>
												</StatusBadge>
											) : isDitutup ? (
												<StatusBadge tone="danger">Ditutup</StatusBadge>
											) : (
												<StatusBadge>Belum dibuka</StatusBadge>
											)}
										</TableCell>
										<TableCell className="text-right">
											{selesai ? (
												<Button asChild variant="outline" size="sm">
													<Link to="/peserta/ujian/$id/hasil" params={{ id: u.id }}>Lihat hasil</Link>
												</Button>
											) : isStartable ? (
												<Button asChild size="sm">
													<Link to="/peserta/ujian/$id" params={{ id: u.id }}>
														{status === "sedang" ? "Lanjutkan ujian" : "Mulai ujian"}
													</Link>
												</Button>
											) : (
												<Button variant="secondary" size="sm" disabled>
													Belum bisa dikerjakan
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
	);
}
