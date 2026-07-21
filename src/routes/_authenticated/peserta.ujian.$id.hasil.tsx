import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { CheckCircle2, XCircle, ChevronLeft, Award, HelpCircle, FileText, LayoutList, EyeOff, BookOpen } from "lucide-react";
import { AudioPlayer } from "@/components/cbt/AudioPlayer";
import { RichView } from "@/components/cbt/RichEditor";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/cbt/auth-store";
import { sesiRepo, soalRepo, ujianRepo } from "@/lib/cbt/repos";
import { cn } from "@/lib/utils";

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
			<div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
				<div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 text-center max-w-sm w-full">
					<HelpCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
					<h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Hasil Tidak Ditemukan</h2>
					<p className="text-slate-500 dark:text-slate-400 text-sm mb-6">Ujian ini mungkin belum Anda selesaikan atau data tidak valid.</p>
					<Button asChild className="w-full font-bold">
						<Link to="/peserta">Kembali ke Dasbor</Link>
					</Button>
				</div>
			</div>
		);
	}

	const maxScore = sesi.maxSkor || 100; // fallback just in case
	const currentScore = sesi.skorTotal || 0;
	const pct = Math.round((currentScore / maxScore) * 100);

	// Determine grade color
	const isPerfect = pct === 100;
	const isGood = pct >= 70 && !isPerfect;
	const isBad = pct < 70;

	const colorClass = isPerfect ? "text-primary border-primary/20 bg-primary/5" :
										 isGood ? "text-emerald-500 border-emerald-500/20 bg-emerald-500/5" :
										 "text-amber-500 border-amber-500/20 bg-amber-500/5";

	const ringColor = isPerfect ? "text-primary" :
										isGood ? "text-emerald-500" :
										"text-amber-500";

	const totalQuestions = sesi.soalIds.length;
	let correctCount = 0;
	
	// Quick calculation for correct answers if it's multiple choice
	sesi.jawaban.forEach((j) => {
		const soal = soalRepo.byId(j.soalId);
		if (soal && soal.tipe !== "essay") {
			const benarIds = soal.jawaban.filter((x) => x.benar).map((x) => x.id);
			if (j.jawabanIds.length === benarIds.length && benarIds.every((id) => j.jawabanIds.includes(id))) {
				correctCount++;
			}
		}
	});

	return (
		<div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 pb-24 pt-8 animate-in fade-in duration-500">
			{/* Navigation */}
			<div className="flex items-center">
				<Link
					to="/peserta"
					className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-4 py-2 rounded-full"
				>
					<ChevronLeft className="w-4 h-4" /> Kembali ke Dasbor
				</Link>
			</div>

			{/* Main Score Card */}
			<div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden relative">
				<div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary via-emerald-400 to-primary" />
				
				<div className="p-8 sm:p-12 text-center flex flex-col items-center">
					<Award className="w-12 h-12 text-primary/40 mb-6" />
					<h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-2">
						{ujian.nama}
					</h1>
					<p className="text-slate-500 dark:text-slate-400 font-medium mb-10">Laporan Hasil Pengerjaan Ujian</p>

					{ujian.showResult ? (
						<div className="flex flex-col items-center">
							<div className={cn(
								"relative flex items-center justify-center w-48 h-48 sm:w-56 sm:h-56 rounded-full border-[6px] shadow-inner mb-6",
								colorClass
							)}>
								<div className="flex flex-col items-center">
									<span className={cn("text-5xl sm:text-6xl font-black tracking-tighter", ringColor)}>
										{currentScore}
									</span>
									<span className="text-slate-400 font-bold uppercase tracking-widest text-sm mt-1">Skor Anda</span>
								</div>
							</div>
							<div className="flex items-center gap-4 text-sm font-semibold text-slate-500 dark:text-slate-400">
								<span className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">Nilai Maksimal: {maxScore}</span>
								<span className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">Persentase: {pct}%</span>
							</div>
						</div>
					) : (
						<div className="flex flex-col items-center justify-center py-8">
							<div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
								<EyeOff className="w-10 h-10 text-slate-400" />
							</div>
							<h3 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-2">Nilai Dirahasiakan</h3>
							<p className="text-slate-500 dark:text-slate-400 max-w-md">
								Penyelenggara ujian memilih untuk tidak menampilkan hasil dan nilai ujian ini kepada peserta secara langsung.
							</p>
						</div>
					)}
				</div>

				{ujian.showResult && (
					<div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-slate-800 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-200 dark:border-slate-800">
						<div className="p-6 text-center">
							<p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Soal</p>
							<p className="text-2xl font-black text-slate-700 dark:text-slate-300">{totalQuestions}</p>
						</div>
						<div className="p-6 text-center">
							<p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Benar (Objektif)</p>
							<p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{correctCount}</p>
						</div>
						<div className="p-6 text-center">
							<p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Durasi Pengerjaan</p>
							<p className="text-2xl font-black text-blue-600 dark:text-blue-400">
								{sesi.mulaiAt && sesi.selesaiAt ? Math.max(1, Math.round((sesi.selesaiAt - sesi.mulaiAt) / 60000)) : 0} <span className="text-sm font-bold text-slate-400">mnt</span>
							</p>
						</div>
					</div>
				)}
			</div>

			{/* Review Section */}
			{ujian.showResult && ujian.showResultDetail && (
				<div className="space-y-6">
					<div className="flex items-center gap-3 ml-2">
						<LayoutList className="w-6 h-6 text-primary" />
						<h2 className="text-2xl font-bold text-slate-900 dark:text-white">Pembahasan Soal</h2>
					</div>

					<div className="space-y-6">
						{sesi.jawaban.map((j, i) => {
							const soal = soalRepo.byId(j.soalId);
							
							if (!soal) {
								return (
									<div key={i} className="bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-6 text-center text-slate-500 font-medium">
										Soal #{i + 1} tidak tersedia lagi di bank soal.
									</div>
								);
							}

							const benarIds = soal.jawaban.filter((x) => x.benar).map((x) => x.id);
							const isEssay = soal.tipe === "essay";
							const correct = !isEssay && j.jawabanIds.length === benarIds.length && benarIds.every((id) => j.jawabanIds.includes(id));

							return (
								<div key={i} className={cn(
									"rounded-3xl border-2 bg-white dark:bg-slate-900 overflow-hidden shadow-sm transition-all",
									isEssay ? "border-slate-200 dark:border-slate-800" :
									correct ? "border-emerald-200 dark:border-emerald-900/50" : "border-red-200 dark:border-red-900/50"
								)}>
									{/* Top Header */}
									<div className={cn(
										"px-6 py-4 border-b-2 flex flex-wrap gap-4 items-center justify-between",
										isEssay ? "bg-slate-50 dark:bg-slate-950 border-slate-100 dark:border-slate-800" :
										correct ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/40" : 
										"bg-red-50 dark:bg-red-950/30 border-red-100 dark:border-red-900/40"
									)}>
										<div className="flex items-center gap-3">
											<div className={cn(
												"flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm text-white",
												isEssay ? "bg-slate-600" : correct ? "bg-emerald-500" : "bg-red-500"
											)}>
												{i + 1}
											</div>
											<span className="font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-widest text-xs">
												{soal.tipe === "pg" ? "Pilihan Ganda" : soal.tipe === "bs" ? "Benar / Salah" : "Esai"}
											</span>
										</div>
										
										<div>
											{isEssay ? (
												<span className="flex items-center gap-1.5 px-3 py-1 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full text-xs font-bold uppercase">
													<BookOpen className="w-3.5 h-3.5" />
													{typeof j.skor === "number" ? `Dinilai: ${j.skor} Poin` : "Belum Dinilai"}
												</span>
											) : correct ? (
												<span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 rounded-full text-xs font-bold uppercase">
													<CheckCircle2 className="w-3.5 h-3.5" /> Benar
												</span>
											) : (
												<span className="flex items-center gap-1.5 px-3 py-1 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400 rounded-full text-xs font-bold uppercase">
													<XCircle className="w-3.5 h-3.5" /> Salah
												</span>
											)}
										</div>
									</div>

									{/* Question Content */}
									<div className="p-6 sm:p-8">
										<div className="prose prose-slate dark:prose-invert max-w-none text-slate-800 dark:text-slate-200 mb-6">
											<RichView html={soal.detail} />
										</div>
										
										{soal.audioFileId && (
											<div className="mb-6 max-w-md">
												<AudioPlayer fileId={soal.audioFileId} playOnce={false} />
											</div>
										)}

										{/* Answers Section */}
										<div className="mt-8 space-y-4">
											{soal.tipe === "essay" ? (
												<div className="bg-slate-50 dark:bg-slate-950 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
													<p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Jawaban Anda:</p>
													<div className="prose prose-slate dark:prose-invert max-w-none prose-p:my-0 text-slate-700 dark:text-slate-300">
														<RichView html={j.jawabanEssay || "<em>(Kosong)</em>"} />
													</div>
												</div>
											) : (
												<div className="space-y-3">
													{soal.jawaban.map((opt, optIndex) => {
														const isUserChoice = j.jawabanIds.includes(opt.id);
														const isCorrectOption = opt.benar;
														const optLetter = String.fromCharCode(65 + optIndex);

														return (
															<div key={opt.id} className={cn(
																"flex items-start gap-4 p-4 rounded-xl border-2 transition-colors",
																isCorrectOption ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50" :
																isUserChoice && !isCorrectOption ? "bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50" :
																"bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800"
															)}>
																<div className={cn(
																	"flex items-center justify-center shrink-0 w-8 h-8 rounded-full font-bold text-sm border-2 mt-0.5",
																	isCorrectOption ? "bg-emerald-500 border-emerald-500 text-white" :
																	isUserChoice ? "bg-red-500 border-red-500 text-white" :
																	"bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500"
																)}>
																	{isCorrectOption ? <CheckCircle2 className="w-5 h-5" /> : 
																	 isUserChoice ? <XCircle className="w-5 h-5" /> : 
																	 optLetter}
																</div>
																<div className="flex-1 mt-1 prose prose-slate dark:prose-invert max-w-none prose-p:my-0">
																	<RichView html={opt.detail} />
																</div>
																
																{(isCorrectOption || isUserChoice) && (
																	<div className="shrink-0 ml-4 flex flex-col gap-1 items-end">
																		{isCorrectOption && (
																			<span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 rounded">Kunci</span>
																		)}
																		{isUserChoice && (
																			<span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">Anda</span>
																		)}
																	</div>
																)}
															</div>
														);
													})}
												</div>
											)}
										</div>

										{/* Explanations (Pembahasan) */}
										{soal.pembahasan && (
											<div className="mt-8 bg-blue-50/50 dark:bg-blue-950/20 rounded-2xl p-6 border border-blue-100 dark:border-blue-900/50 relative overflow-hidden">
												<div className="absolute top-0 left-0 w-1 h-full bg-blue-400" />
												<div className="flex items-center gap-2 mb-3 text-blue-700 dark:text-blue-400">
													<FileText className="w-5 h-5" />
													<h4 className="font-bold uppercase tracking-widest text-sm">Pembahasan</h4>
												</div>
												<div className="prose prose-slate dark:prose-invert max-w-none text-slate-700 dark:text-slate-300">
													<RichView html={soal.pembahasan} />
												</div>
											</div>
										)}
									</div>
								</div>
							);
						})}
					</div>
				</div>
			)}
			
			<div className="pt-8 flex justify-center">
				<Button asChild size="lg" className="h-14 px-10 font-bold uppercase tracking-widest rounded-xl shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5">
					<Link to="/peserta">Selesai & Kembali</Link>
				</Button>
			</div>
		</div>
	);
}
