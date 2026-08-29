/* eslint-disable @typescript-eslint/no-explicit-any */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { prisma } from "../db/prisma";
import {
	requireCaller,
	seedIfNeeded,
	operatorHasAnyNav,
	operatorCanTouchUjian,
	pesertaCanTouchUjian,
} from "../db/auth";
import type { SesiUjian, NavKey } from "@/lib/cbt/types";
import { writeAuditLog } from "../db/audit";
import { stringifyJson, toBigInt, toNumber, parseJson } from "../db/json";
import { getRequestIP } from "@tanstack/start-server-core";
import { ipInRanges } from "@/lib/cbt/cidr";
import { gradeAnswers } from "@/lib/cbt/scoring";
import { validateParticipantAnswers } from "@/lib/cbt/session-answers";
import { uid } from "@/lib/cbt/storage";
import { mapSoal, mapSesi, mapUjian } from "../repos/mappers";
import { Prisma } from "@prisma/client";

const OPERATOR_SESSION_KEYS: NavKey[] = [
	"ujian",
	"hasil",
	"evaluasi",
	"laporan",
	"leaderboard",
];
const SUBMIT_GRACE_MS = 30_000;

// Authoritative server-side grading at submit time. The participant's client
// also computes a provisional grade for instant display, but the persisted
// score is always recomputed here from the DB soal/jawaban so a participant
// can never dictate their own `skor`/`skorTotal` (the rules live in the shared
// pure module src/lib/cbt/scoring.ts).
async function gradeSesiServerSide(item: SesiUjian): Promise<SesiUjian> {
	const ujianRow = await prisma.ujian.findUnique({ where: { id: item.ujianId } });
	if (!ujianRow) return { ...item, skorTotal: undefined, maxSkor: undefined };
	const soalById = new Map(
		(item.soalSnapshot.length > 0
			? item.soalSnapshot
			: (await prisma.soal.findMany({
					where: { id: { in: item.soalIds } },
					include: { jawaban: true },
				})).map(mapSoal)
		).map((soal) => [soal.id, soal] as const),
	);
	const { jawaban, skorTotal, maxSkor } = gradeAnswers(mapUjian(ujianRow), soalById, item.jawaban);
	return {
		...item,
		jawaban,
		skorTotal,
		maxSkor,
		selesaiAt: item.selesaiAt ?? Date.now(),
	};
}

const participantAnswerSchema = z
	.object({
		soalId: z.string().min(1),
		jawabanIds: z.array(z.string()),
		jawabanEssay: z.string(),
		ragu: z.boolean(),
	})
	.strict();

export const saveParticipantSesiServer = createServerFn({ method: "POST" })
	.validator(
		z.object({
			sesiId: z.string().min(1),
			action: z.enum(["save", "submit"]),
			jawaban: z.array(participantAnswerSchema),
		}),
	)
	.handler(async ({ data }) => {
		try {
			const caller = await requireCaller();
			if (!caller || caller.role !== "mahasiswa") {
				return { ok: false as const, error: "Forbidden" };
			}

			const sesiRow = await prisma.sesiUjian.findUnique({
				where: { id: data.sesiId },
				include: { ujian: true },
			});
			if (
				!sesiRow ||
				sesiRow.pesertaId !== caller.id ||
				!(await pesertaCanTouchUjian(caller, sesiRow.ujianId))
			) {
				return { ok: false as const, error: "Forbidden" };
			}
			if (sesiRow.status !== "sedang") {
				return { ok: false as const, error: "Ujian sudah disubmit oleh pengawas" };
			}
			const now = Date.now();
			const endsAt = toNumber(sesiRow.endsAt);
			const examEndAt = toNumber(sesiRow.ujian.endAt);
			const timedOut =
				(endsAt !== undefined && now > endsAt) ||
				(examEndAt !== undefined && now > examEndAt);
			// Allow the client's final submit to arrive after the deadline; a plain
			// autosave after the deadline must still be rejected.
			const deadline = Math.min(
				endsAt ?? Number.POSITIVE_INFINITY,
				examEndAt ?? Number.POSITIVE_INFINITY,
			);
			if (timedOut && (data.action !== "submit" || now > deadline + SUBMIT_GRACE_MS)) {
				return { ok: false as const, error: "Ujian sudah berakhir" };
			}

			if (sesiRow.ujian.ipRange) {
				const ip = getRequestIP({ xForwardedFor: true }) ?? "unknown";
				if (!ipInRanges(ip, sesiRow.ujian.ipRange)) {
					return {
						ok: false as const,
						error: "Akses ditolak: IP Anda tidak diizinkan untuk ujian ini.",
					};
				}
			}

			const soalIds = parseJson<string[]>(sesiRow.soalIds, []);
			const soalById = new Map(
			(sesiRow.soalSnapshot
				? parseJson<ReturnType<typeof mapSoal>[]>(sesiRow.soalSnapshot, [])
				: []
			).length > 0
				? parseJson<ReturnType<typeof mapSoal>[]>(sesiRow.soalSnapshot, []).map((soal) => [soal.id, soal] as const)
				: (await prisma.soal.findMany({
						where: { id: { in: soalIds } },
						include: { jawaban: true },
					})).map((row) => [row.id, mapSoal(row)] as const),
		);
			const jawaban = validateParticipantAnswers(soalIds, soalById, data.jawaban);
			if (!jawaban) {
				return { ok: false as const, error: "Jawaban ujian tidak valid." };
			}

			const updateData =
				data.action === "submit"
					? (() => {
							const graded = gradeAnswers(mapUjian(sesiRow.ujian), soalById, jawaban);
							return {
								status: "selesai" as const,
								selesaiAt: BigInt(Date.now()),
								jawaban: stringifyJson(graded.jawaban),
								skorTotal: graded.skorTotal,
								maxSkor: graded.maxSkor,
							};
						})()
					: { jawaban: stringifyJson(jawaban) };

			const updated = await prisma.sesiUjian.updateMany({
				where: { id: data.sesiId, pesertaId: caller.id, status: "sedang" },
				data: updateData,
			});
			if (updated.count !== 1) {
				return { ok: false as const, error: "Ujian sudah disubmit oleh pengawas" };
			}

			return { ok: true as const };
		} catch (err) {
			console.error("[saveParticipantSesiServer]", err);
			return { ok: false as const, error: "Gagal menyimpan jawaban ujian." };
		}
	});

export const mutateSesiServer = createServerFn({ method: "POST" })
	.validator(
		z.object({
			action: z.enum(["upsert", "remove", "bulkSet"]),
			payload: z.any(),
		}),
	)
	.handler(async ({ data }) => {
		try {
			await seedIfNeeded();
			const caller = await requireCaller();
			if (!caller) return { ok: false as const, error: "Forbidden" };
			if (caller.role === "mahasiswa") {
				return { ok: false as const, error: "Forbidden" };
			}

			const { action, payload } = data;

			if (caller.role === "admin_prodi" || caller.role === "evaluator") {
				if (!(await operatorHasAnyNav(caller, OPERATOR_SESSION_KEYS)))
					return { ok: false as const, error: "Forbidden" };
				if (caller.role === "evaluator" && action !== "upsert") {
					return { ok: false as const, error: "Evaluator hanya dapat memperbarui penilaian." };
				}
				const ujianId =
					action === "remove"
						? (
								await prisma.sesiUjian.findUnique({
									where: { id: String((payload as { id?: string }).id ?? "") },
									select: { ujianId: true },
								})
							)?.ujianId
						: action === "upsert"
							? ((await prisma.sesiUjian.findUnique({
									where: { id: String((payload as SesiUjian).id ?? "") },
									select: { ujianId: true },
								}))?.ujianId ?? (payload as SesiUjian).ujianId)
							: undefined;
				if (!ujianId || !(await operatorCanTouchUjian(caller, ujianId))) {
					return { ok: false as const, error: "Forbidden" };
				}
			} else if (caller.role !== "super_admin") {
				return { ok: false as const, error: "Forbidden" };
			}

			// Do not audit `sesi` (was explicitly skipped in functions.ts)

			let upsertItem: SesiUjian | undefined;
			let existingStatus: SesiUjian["status"] | undefined;
			if (action === "upsert") {
				const item = payload as SesiUjian;
				const existing = await prisma.sesiUjian.findUnique({ where: { id: item.id } });
				existingStatus = existing?.status;
				const existingItem = existing ? mapSesi(existing) : undefined;
				upsertItem = existingItem
					? {
							...existingItem,
							status: item.status,
							jawaban: existingItem.jawaban.map((answer) => {
								const grading = item.jawaban.find((candidate) => candidate.soalId === answer.soalId);
								return grading
									? { ...answer, skor: grading.skor, catatanGrader: grading.catatanGrader }
									: answer;
							}),
							pelanggaran: item.pelanggaran,
						}
					: item;
				if (caller.role === "evaluator") {
					if (!existingItem || existingItem.status !== "selesai") {
						return { ok: false as const, error: "Sesi belum selesai untuk dievaluasi." };
					}
					upsertItem = {
						...upsertItem,
						status: existingItem.status,
						pelanggaran: existingItem.pelanggaran,
					};
				}
				if (upsertItem.status === "selesai") {
					upsertItem = {
						...(await gradeSesiServerSide(upsertItem)),
						gradedAt: Date.now(),
						gradedBy: caller.id,
					};
				} else {
					upsertItem = { ...upsertItem, skorTotal: undefined, maxSkor: undefined };
				}
			}

			await prisma.$transaction(async (tx) => {
				if (action === "remove")
					await tx.sesiUjian.delete({ where: { id: String(payload.id) } });
				else if (action === "bulkSet") {
					await tx.sesiUjian.deleteMany();
					await tx.sesiUjian.createMany({
						data: (payload as SesiUjian[]).map((item) => ({
							...item,
							mulaiAt: toBigInt(item.mulaiAt),
							selesaiAt: toBigInt(item.selesaiAt),
							endsAt: toBigInt(item.endsAt),
							soalIds: stringifyJson(item.soalIds),
							soalSnapshot: stringifyJson(item.soalSnapshot),
							jawabanOrder: stringifyJson(item.jawabanOrder),
							jawaban: stringifyJson(item.jawaban),
							gradedAt: toBigInt(item.gradedAt),
							gradedBy: item.gradedBy ?? null,
							createdAt: BigInt(item.createdAt),
						})),
					});
				} else if (upsertItem) {
					const existing = await tx.sesiUjian.findUnique({ where: { id: upsertItem.id } });
					if (existingStatus !== "selesai" && existing?.status === "selesai") {
						throw new Error("Sesi sudah diselesaikan oleh proses lain.");
					}
					if (existing?.status === "selesai" && upsertItem.status !== "selesai") {
						throw new Error("Sesi yang sudah selesai tidak dapat dibuka kembali.");
					}
					const item =
						existing?.status === "selesai"
							? { ...upsertItem, status: "selesai" as const, selesaiAt: toNumber(existing.selesaiAt) }
							: upsertItem;
					const updateData: any = {
						status: item.status,
						selesaiAt: toBigInt(item.selesaiAt),
						jawaban: stringifyJson(item.jawaban),
						pelanggaran: item.pelanggaran,
						skorTotal: item.skorTotal ?? null,
						maxSkor: item.maxSkor ?? null,
						gradedAt: toBigInt(item.gradedAt),
						gradedBy: item.gradedBy ?? null,
					};
					const createData: any = {
						...updateData,
						id: item.id,
						ujianId: item.ujianId,
						pesertaId: item.pesertaId,
						mulaiAt: toBigInt(item.mulaiAt),
						endsAt: toBigInt(item.endsAt),
						soalIds: stringifyJson(item.soalIds),
						soalSnapshot: stringifyJson(item.soalSnapshot),
						jawabanOrder: stringifyJson(item.jawabanOrder),
						createdAt: BigInt(item.createdAt),
					};

					await tx.sesiUjian.upsert({
						where: { id: item.id },
						update: updateData,
						create: createData,
					});
				}
			});
			return { ok: true as const };
		} catch (err) {
			return {
				ok: false as const,
				error: err instanceof Error ? err.message : String(err),
			};
		}
	});

export const actionLiveSesiServer = createServerFn({ method: "POST" })
	.validator(z.object({ sesiId: z.string().min(1), action: z.enum(["forceSubmit", "resetPelanggaran"]) }))
	.handler(async ({ data }) => {
		try {
			const caller = await requireCaller();
			if (!caller || caller.role === "mahasiswa") return { ok: false as const, error: "Forbidden" };
			const sesi = await prisma.sesiUjian.findUnique({
				where: { id: data.sesiId },
				select: { ujianId: true, status: true },
			});
			if (!sesi || (caller.role !== "super_admin" && !(await operatorCanTouchUjian(caller, sesi.ujianId)))) {
				return { ok: false as const, error: "Forbidden" };
			}
			if (data.action === "forceSubmit") {
				if (sesi.status === "selesai") return { ok: true as const };
				// Grade server-side so a forced submit stores the same authoritative score as a normal submit.
				const row = await prisma.sesiUjian.findUnique({ where: { id: data.sesiId } });
				if (row) {
					const scored = await gradeSesiServerSide(mapSesi(row));
					await prisma.sesiUjian.update({
						where: { id: data.sesiId },
						data: {
							status: "selesai",
							selesaiAt: BigInt(Date.now()),
							jawaban: stringifyJson(scored.jawaban),
							skorTotal: scored.skorTotal ?? null,
							maxSkor: scored.maxSkor ?? null,
						},
					});
				} else {
					await prisma.sesiUjian.update({
						where: { id: data.sesiId },
						data: { status: "selesai", selesaiAt: BigInt(Date.now()) },
					});
				}
			} else {
				await prisma.sesiUjian.update({
					where: { id: data.sesiId },
					data: { pelanggaran: 0 },
				});
			}
			void writeAuditLog({ userId: caller.id, userRole: caller.role, action: `sesi.${data.action}`, entity: "sesi", entityId: data.sesiId });
			return { ok: true as const };
		} catch (err) {
			return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
		}
	});

export const getLiveOnlineSesis = createServerFn({ method: "GET" }).handler(
	async () => {
		const caller = await requireCaller();
		if (!caller || caller.role === "mahasiswa") return [];
		const rows = await prisma.sesiUjian.findMany({
			where: { status: "sedang" },
			include: { peserta: true, ujian: true }
		});
		// ponytail: super_admin sees all live sessions; operators only see ujian they can touch.
		// If operator-all-read is intended by design, drop this filter.
		const scoped: typeof rows = [];
		for (const r of rows) {
			if (caller.role === "super_admin" || await operatorCanTouchUjian(caller, r.ujianId)) scoped.push(r);
		}
		return scoped.map((r: any) => {
			const soalIds = parseJson<string[]>(r.soalIds, []);
			const jawaban = parseJson<any[]>(r.jawaban, []);
			const dijawab = jawaban.filter((j: any) => (j.jawabanIds && j.jawabanIds.length > 0) || (j.jawabanEssay && j.jawabanEssay.length > 0)).length;
			const totalSoal = soalIds.length || 1;
			return {
				id: r.id,
				ujianId: r.ujianId,
				pesertaId: r.pesertaId,
				status: r.status,
				mulaiAt: Number(r.mulaiAt),
				endsAt: Number(r.endsAt),
				pelanggaran: r.pelanggaran,
				user: r.peserta ? { namaLengkap: r.peserta.namaLengkap, username: r.peserta.username } : undefined,
				ujian: r.ujian ? { nama: r.ujian.nama } : undefined,
				dijawab,
				totalSoal,
			};
		});
	}
);

function shuffle<T>(arr: T[]): T[] {
	const a = arr.slice();
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

export const createSesiServer = createServerFn({ method: "POST" })
	.validator(z.object({ ujianId: z.string().min(1) }))
	.handler(async ({ data }) => {
		try {
			await seedIfNeeded();
			const caller = await requireCaller();
			if (!caller || caller.role !== "mahasiswa") return { ok: false as const, error: "Forbidden" };

			if (!(await pesertaCanTouchUjian(caller, data.ujianId))) {
				return { ok: false as const, error: "Peserta tidak terdaftar pada ujian ini." };
			}

			const ujianRow = await prisma.ujian.findUnique({
				where: { id: data.ujianId },
			});
			if (!ujianRow) return { ok: false as const, error: "Ujian tidak ditemukan." };

			const ujian = mapUjian(ujianRow);
			if (ujian.status !== "published") return { ok: false as const, error: "Ujian belum dipublikasikan." };

			// 1. Idempotent resume: jika sudah ada sesi yang sedang berlangsung
			const existing = await prisma.sesiUjian.findFirst({
				where: { ujianId: ujian.id, pesertaId: caller.id, status: { not: "selesai" } },
				select: { id: true },
			});
			if (existing) {
				return { ok: true as const, sesiId: existing.id };
			}

			// 2. Jika sudah pernah selesai
			const finished = await prisma.sesiUjian.findFirst({
				where: { ujianId: ujian.id, pesertaId: caller.id, status: "selesai" },
				select: { id: true },
			});
			if (finished) {
				return { ok: false as const, error: "Ujian sudah selesai dikerjakan." };
			}

			// 3. Validasi jadwal
			const now = Date.now();
			if (ujian.beginAt !== undefined && now < ujian.beginAt) {
				return { ok: false as const, error: "Ujian belum dimulai" };
			}
			if (ujian.endAt !== undefined && now > ujian.endAt) {
				return { ok: false as const, error: "Ujian sudah berakhir" };
			}

			// 4. Validasi IP Range
			if (ujian.ipRange) {
				const ip = getRequestIP({ xForwardedFor: true }) ?? "unknown";
				if (!ipInRanges(ip, ujian.ipRange)) {
					return {
						ok: false as const,
						error: "Akses ditolak: IP Anda tidak diizinkan untuk ujian ini.",
					};
				}
			}

			// 5. Validasi Token
			if (ujian.tokenAktif) {
				const claimed = await prisma.tokenClaim.findUnique({
					where: { ujianId_pesertaId: { ujianId: ujian.id, pesertaId: caller.id } },
				});
				if (!claimed) {
					return {
						ok: false as const,
						error: "Akses ditolak: Anda belum mengklaim token untuk ujian ini.",
					};
				}
			}

			// 6. Pilih soal dari database
			const allSoal = await prisma.soal.findMany({
				where: {
					topikId: { in: ujian.topicSets.map((ts) => ts.topikId) },
				},
				include: { jawaban: true },
			});

			const soalPools = new Map<string, typeof allSoal>();
			for (const s of allSoal) {
				if (!soalPools.has(s.topikId)) soalPools.set(s.topikId, []);
				soalPools.get(s.topikId)!.push(s);
			}

			const soalTerpilih = [];
			const sourceTopikIds = new Set<string>();
			for (const ts of ujian.topicSets) {
				if (sourceTopikIds.has(ts.topikId)) {
					return {
						ok: false as const,
						error: "Sumber topik duplikat tidak dapat digunakan untuk membuat sesi.",
					};
				}
				sourceTopikIds.add(ts.topikId);
				let pool = soalPools.get(ts.topikId) || [];
				if (ts.tipe) pool = pool.filter((s) => s.tipe === ts.tipe);
				if (ts.kesulitan) pool = pool.filter((s) => s.kesulitan === ts.kesulitan);
				const chosen = (ts.acakSoal ? shuffle(pool) : pool).slice(0, ts.jumlah);
				if (chosen.length < ts.jumlah) {
					return {
						ok: false as const,
						error: `Bank soal untuk topik terkait ujian "${ujian.nama}" belum cukup.`,
					};
				}
				soalTerpilih.push(...chosen);
			}

			if (soalTerpilih.length === 0) {
				return {
					ok: false as const,
					error: `Bank soal untuk ujian "${ujian.nama}" belum cukup atau tidak cocok dengan filter topik.`,
				};
			}

			const jawabanOrder: Record<string, string[]> = {};
			for (const s of soalTerpilih) {
				const ids = s.jawaban.map((j) => j.id);
				jawabanOrder[s.id] = ujian.topicSets.find((ts) => ts.topikId === s.topikId)?.acakJawaban
					? shuffle(ids)
					: ids;
			}

			const sesiId = uid("se_");

			await prisma.sesiUjian.create({
				data: {
					id: sesiId,
					ujianId: ujian.id,
					pesertaId: caller.id,
					status: "sedang",
					mulaiAt: BigInt(now),
					endsAt: BigInt(
						Math.min(
							now + ujian.durasiMenit * 60_000,
							ujian.endAt ?? Number.MAX_SAFE_INTEGER,
						),
					),
					soalIds: stringifyJson(soalTerpilih.map((s) => s.id)),
					soalSnapshot: stringifyJson(soalTerpilih.map(mapSoal)),
					jawabanOrder: stringifyJson(jawabanOrder),
					jawaban: stringifyJson(
						soalTerpilih.map((s) => ({
							soalId: s.id,
							jawabanIds: [],
							jawabanEssay: "",
							ragu: false,
						})),
					),
					createdAt: BigInt(now),
				},
			});

			return { ok: true as const, sesiId };
		} catch (err) {
			if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
				const retryCaller = await requireCaller();
				if (!retryCaller) return { ok: false as const, error: "Forbidden" };
				const existing = await prisma.sesiUjian.findUnique({
					where: { ujianId_pesertaId: { ujianId: data.ujianId, pesertaId: retryCaller.id } },
					select: { id: true, status: true },
				});
				if (existing?.status !== "selesai") return { ok: true as const, sesiId: existing!.id };
				return { ok: false as const, error: "Ujian sudah selesai dikerjakan." };
			}
			console.error("[createSesiServer]", err);
			return { ok: false as const, error: "Gagal membuat sesi ujian." };
		}
	});
