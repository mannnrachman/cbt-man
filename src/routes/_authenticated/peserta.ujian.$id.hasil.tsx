import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { AudioPlayer } from "@/components/cbt/AudioPlayer";
import { RichView } from "@/components/cbt/RichEditor";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/cbt/auth-store";
import { sesiRepo, soalBySessionId, ujianRepo } from "@/lib/cbt/repos";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/cbt/StatusBadge";

export const Route = createFileRoute("/_authenticated/peserta/ujian/$id/hasil")(
	{
		component: HasilPeserta,
	},
);

function HasilPeserta() {
	const { id } = useParams({ from: "/_authenticated/peserta/ujian/$id/hasil" });
	const user = useAuthStore((s) => s.user)!;
	const ujian = ujianRepo.byId(id);
	const sesi = sesiRepo
		.all()
		.find(
			(s) =>
				s.ujianId === id && s.pesertaId === user.id && s.status === "selesai",
		);

	if (!ujian || !sesi) {
		return (
			<div className="mx-auto flex min-h-[60vh] max-w-sm flex-col items-center justify-center gap-4 px-4 text-center">
				<h1 className="text-heading font-medium text-foreground">Hasil tidak ditemukan</h1>
				<p className="text-ui text-muted-foreground">
					Ujian ini mungkin belum Anda selesaikan atau datanya tidak valid.
				</p>
				<Button asChild className="w-full">
					<Link to="/peserta">Kembali ke daftar ujian</Link>
				</Button>
			</div>
		);
	}

	const maxScore = sesi.maxSkor || 100; // fallback just in case
	const currentScore = sesi.skorTotal || 0;
	const pct = Math.round((currentScore / maxScore) * 100);

	const totalQuestions = sesi.soalIds.length;
	let correctCount = 0;
	
	// Quick calculation for correct answers if it's multiple choice
	sesi.jawaban.forEach((j) => {
		const soal = soalBySessionId(sesi.id, j.soalId);
		if (soal && soal.tipe !== "essay") {
			const benarIds = soal.jawaban.filter((x) => x.benar).map((x) => x.id);
			if (j.jawabanIds.length === benarIds.length && benarIds.every((id) => j.jawabanIds.includes(id))) {
				correctCount++;
			}
		}
	});

	return (
		<div className="mx-auto w-full max-w-4xl space-y-8 px-4 py-8 sm:px-6">
			<Link to="/peserta" className="inline-flex text-ui text-muted-foreground hover:text-foreground">
				← Kembali ke daftar ujian
			</Link>

			<section className="space-y-6 rounded-lg border bg-card p-6 sm:p-8">
				<div className="space-y-1">
					<h1 className="text-title font-medium tracking-tight text-foreground">{ujian.nama}</h1>
					<p className="text-ui text-muted-foreground">Hasil pengerjaan ujian</p>
				</div>

				{ujian.showResult ? (
					<>
						<div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
							<p className="text-6xl font-semibold tabular-nums text-foreground">{currentScore}</p>
							<p className="text-body text-muted-foreground tabular-nums">
								dari {maxScore} ({pct}%)
							</p>
						</div>
						<dl className="grid grid-cols-1 gap-4 border-t pt-6 sm:grid-cols-3">
							<div>
								<dt className="text-label text-muted-foreground">Jumlah soal</dt>
								<dd className="text-heading font-medium tabular-nums">{totalQuestions}</dd>
							</div>
							<div>
								<dt className="text-label text-muted-foreground">Benar (objektif)</dt>
								<dd className="text-heading font-medium tabular-nums">{correctCount}</dd>
							</div>
							<div>
								<dt className="text-label text-muted-foreground">Durasi pengerjaan</dt>
								<dd className="text-heading font-medium tabular-nums">
									{sesi.mulaiAt && sesi.selesaiAt ? Math.max(1, Math.round((sesi.selesaiAt - sesi.mulaiAt) / 60000)) : 0} menit
								</dd>
							</div>
						</dl>
					</>
				) : (
					<div className="space-y-1 border-t pt-6">
						<h2 className="text-heading font-medium text-foreground">Nilai tidak ditampilkan</h2>
						<p className="text-body text-muted-foreground">
							Penyelenggara ujian memilih untuk tidak menampilkan nilai ujian ini kepada peserta.
						</p>
					</div>
				)}
			</section>

			{ujian.showResult && ujian.showResultDetail && (
				<section className="space-y-6">
					<h2 className="text-heading font-medium text-foreground">Pembahasan soal</h2>

					<div className="space-y-6">
						{sesi.jawaban.map((j, i) => {
							const soal = soalBySessionId(sesi.id, j.soalId);

							if (!soal) {
								return (
									<div key={i} className="rounded-lg border border-dashed p-6 text-center text-ui text-muted-foreground">
										Soal nomor {i + 1} tidak tersedia lagi di bank soal.
									</div>
								);
							}

							const benarIds = soal.jawaban.filter((x) => x.benar).map((x) => x.id);
							const isEssay = soal.tipe === "essay";
							const correct = !isEssay && j.jawabanIds.length === benarIds.length && benarIds.every((id) => j.jawabanIds.includes(id));

							return (
								<article key={i} className="overflow-hidden rounded-lg border bg-card">
									<header className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted px-6 py-3">
										<p className="text-ui font-medium text-foreground">
											Soal {i + 1} ·{" "}
											<span className="font-normal text-muted-foreground">
												{soal.tipe === "pg" ? "Pilihan ganda" : soal.tipe === "bs" ? "Benar atau salah" : "Esai"}
											</span>
										</p>
										{isEssay ? (
											<StatusBadge>{typeof j.skor === "number" ? `Dinilai: ${j.skor} poin` : "Belum dinilai"}</StatusBadge>
										) : correct ? (
											<StatusBadge tone="active">Benar</StatusBadge>
										) : (
											<StatusBadge tone="danger">Salah</StatusBadge>
										)}
									</header>

									<div className="space-y-6 p-6">
										<div className="prose prose-slate max-w-none text-foreground dark:prose-invert">
											<RichView html={soal.detail} />
										</div>

										{soal.audioFileId && (
											<div className="max-w-md">
												<AudioPlayer fileId={soal.audioFileId} playOnce={false} />
											</div>
										)}

										{soal.tipe === "essay" ? (
											<div className="rounded-lg border bg-muted p-4">
												<p className="mb-2 text-label text-muted-foreground">Jawaban Anda</p>
												{/* jawabanEssay adalah plain text dari Textarea — render
												    sebagai teks (bukan HTML) agar karakter <, &, dan baris
												    baru tampil apa adanya dan tidak diparse sebagai markup. */}
												{j.jawabanEssay?.trim() ? (
													<p className="whitespace-pre-wrap text-foreground">{j.jawabanEssay}</p>
												) : (
													<em className="text-muted-foreground">(Kosong)</em>
												)}
											</div>
										) : (
											<ul className="space-y-3">
												{soal.jawaban.map((opt, optIndex) => {
													const isUserChoice = j.jawabanIds.includes(opt.id);
													const isCorrectOption = opt.benar;
													const optLetter = String.fromCharCode(65 + optIndex);

													return (
														<li
															key={opt.id}
															className={cn(
																"flex items-start gap-4 rounded-lg border p-4",
																isCorrectOption
																	? "border-2 border-primary bg-primary/10"
																	: isUserChoice
																		? "border-2 border-destructive bg-destructive/10"
																		: "border-foreground/30 bg-card",
															)}
														>
															<span
																className={cn(
																	"flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-ui font-semibold",
																	isCorrectOption
																		? "border-primary bg-primary text-primary-foreground"
																		: isUserChoice
																			? "border-destructive bg-destructive text-destructive-foreground"
																			: "border-foreground/30 bg-muted text-muted-foreground",
																)}
															>
																{optLetter}
															</span>
															<div className="prose prose-slate min-w-0 flex-1 pt-1 max-w-none prose-p:my-0 dark:prose-invert">
																<RichView html={opt.detail} />
															</div>
															{(isCorrectOption || isUserChoice) && (
																<div className="flex shrink-0 flex-col items-end gap-1 text-label font-medium">
																	{isCorrectOption && <span className="text-primary">Kunci jawaban</span>}
																	{isUserChoice && (
																		<span className={isCorrectOption ? "text-primary" : "text-destructive"}>
																			Jawaban Anda
																		</span>
																	)}
																</div>
															)}
														</li>
													);
												})}
											</ul>
										)}

										{soal.pembahasan && (
											<div className="space-y-2 rounded-lg border-l-2 border-primary bg-muted p-4">
												<h3 className="text-ui font-medium text-foreground">Pembahasan</h3>
												<div className="prose prose-slate max-w-none text-foreground dark:prose-invert">
													<RichView html={soal.pembahasan} />
												</div>
											</div>
										)}
									</div>
								</article>
							);
						})}
					</div>
				</section>
			)}

			<div className="flex justify-center">
				<Button asChild size="lg">
					<Link to="/peserta">Kembali ke daftar ujian</Link>
				</Button>
			</div>
		</div>
	);
}
