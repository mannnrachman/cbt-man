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
import { mapSoal, mapSesi, mapUjian } from "../repos/mappers";

const OPERATOR_SESSION_KEYS: NavKey[] = [
	"ujian",
	"hasil",
	"evaluasi",
	"laporan",
	"leaderboard",
];

// Authoritative server-side grading at submit time. The participant's client
// also computes a provisional grade for instant display, but the persisted
// score is always recomputed here from the DB soal/jawaban so a participant
// can never dictate their own `skor`/`skorTotal` (the rules live in the shared
// pure module src/lib/cbt/scoring.ts).
async function gradeSesiServerSide(item: SesiUjian): Promise<SesiUjian> {
	const ujianRow = await prisma.ujian.findUnique({ where: { id: item.ujianId } });
	if (!ujianRow) return { ...item, skorTotal: undefined, maxSkor: undefined };
	const soalRows = await prisma.soal.findMany({
		where: { id: { in: item.soalIds } },
		include: { jawaban: true },
	});
	const soalById = new Map(soalRows.map((r) => [r.id, mapSoal(r)]));
	const { jawaban, skorTotal, maxSkor } = gradeAnswers(mapUjian(ujianRow), soalById, item.jawaban);
	return {
		...item,
		jawaban,
		skorTotal,
		maxSkor,
		selesaiAt: item.selesaiAt ?? Date.now(),
	};
}

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

			const { action, payload } = data;

			if (caller.role === "admin_prodi" || caller.role === "evaluator") {
				if (!(await operatorHasAnyNav(caller, OPERATOR_SESSION_KEYS)))
					return { ok: false as const, error: "Forbidden" };
				const ujianId =
					action === "remove"
						? (
								await prisma.sesiUjian.findUnique({
									where: { id: String((payload as { id?: string }).id ?? "") },
									select: { ujianId: true },
								})
							)?.ujianId
						: (payload as SesiUjian).ujianId;
				if (!ujianId || !(await operatorCanTouchUjian(caller, ujianId))) {
					return { ok: false as const, error: "Forbidden" };
				}
			} else if (caller.role === "mahasiswa") {
				if (action !== "upsert") return { ok: false as const, error: "Forbidden" };

				const item = payload as SesiUjian;
				if (item.pesertaId !== caller.id)
					return { ok: false as const, error: "Forbidden" };
				if (!(await pesertaCanTouchUjian(caller, item.ujianId)))
					return { ok: false as const, error: "Forbidden" };
				const existing = await prisma.sesiUjian.findUnique({
					where: { id: item.id },
					select: { pesertaId: true, ujianId: true, status: true },
				});
				if (
					existing &&
					(existing.pesertaId !== caller.id || existing.ujianId !== item.ujianId)
				) {
					return { ok: false as const, error: "Forbidden" };
				}
				if (existing && existing.status === "selesai") {
					// Prevent student's debounced save from resurrecting a forced-submit session
					return { ok: false as const, error: "Ujian sudah disubmit oleh pengawas" };
				}
				const ujianForIp = await prisma.ujian.findUnique({
					where: { id: item.ujianId },
					select: { ipRange: true },
				});
				if (ujianForIp?.ipRange) {
					const ip = getRequestIP({ xForwardedFor: true }) ?? "unknown";
					if (!ipInRanges(ip, ujianForIp.ipRange)) {
						return {
							ok: false as const,
							error: "Akses ditolak: IP Anda tidak diizinkan untuk ujian ini.",
						};
					}
				}
				if (item.status === "sedang") {
					const ujian = await prisma.ujian.findUnique({
						where: { id: item.ujianId },
						select: { beginAt: true, endAt: true },
					});
					if (ujian) {
						const beginAt = toNumber(ujian.beginAt);
						const endAt = toNumber(ujian.endAt);
						const now = Date.now();
						if (beginAt !== undefined && now < beginAt) {
							return { ok: false as const, error: "Ujian belum dimulai" };
						}
						if (endAt !== undefined && now > endAt) {
							return { ok: false as const, error: "Ujian sudah berakhir" };
						}
					}
				}

				if (!existing) {
					const ujianData = await prisma.ujian.findUnique({ where: { id: item.ujianId }, select: { tokenAktif: true } });
					if (ujianData?.tokenAktif) {
						const claimed = await prisma.tokenClaim.findUnique({
							where: { ujianId_pesertaId: { ujianId: item.ujianId, pesertaId: caller.id } },
						});
						const legacyClaimed = claimed
							? true
							: await prisma.tokenUjian.findFirst({
									where: { ujianId: item.ujianId, dipakaiOleh: caller.id },
								});
						if (!claimed && !legacyClaimed) {
							return { ok: false as const, error: "Akses ditolak: Anda belum mengklaim token untuk ujian ini." };
						}
					}
				}
			} else if (caller.role !== "super_admin") {
				return { ok: false as const, error: "Forbidden" };
			}

			// Do not audit `sesi` (was explicitly skipped in functions.ts)

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
							jawabanOrder: stringifyJson(item.jawabanOrder),
							jawaban: stringifyJson(item.jawaban),
							gradedAt: toBigInt(item.gradedAt),
							gradedBy: item.gradedBy ?? null,
							createdAt: BigInt(item.createdAt),
						})),
					});
				} else {
					const item = payload as SesiUjian;

					// A participant must never dictate their own score or grader
					// note. Strip any grading fields supplied by the client, then
					// recompute the score authoritatively on the server at submit
					// time so the persisted record matches the canonical rules.
					let scoredItem = item;
					if (caller.role === "mahasiswa") {
						scoredItem = {
							...item,
							jawaban: (item.jawaban || []).map((j: any) => ({
								...j,
								skor: undefined,
								catatanGrader: undefined,
							})),
							skorTotal: undefined,
							maxSkor: undefined,
						};
						if (scoredItem.status === "selesai") {
							scoredItem = await gradeSesiServerSide(scoredItem);
						}
					}

					const isMahasiswa = caller.role === "mahasiswa";
					let updateData: any = {
						ujianId: scoredItem.ujianId,
						pesertaId: scoredItem.pesertaId,
						status: scoredItem.status,
						mulaiAt: toBigInt(scoredItem.mulaiAt),
						selesaiAt: toBigInt(scoredItem.selesaiAt),
						endsAt: toBigInt(scoredItem.endsAt),
						soalIds: stringifyJson(scoredItem.soalIds),
						jawabanOrder: stringifyJson(scoredItem.jawabanOrder),
						jawaban: stringifyJson(scoredItem.jawaban),

						pelanggaran: scoredItem.pelanggaran,
						skorTotal: scoredItem.skorTotal ?? null,
						maxSkor: scoredItem.maxSkor ?? null,
						gradedAt: isMahasiswa ? null : toBigInt(scoredItem.gradedAt),
						gradedBy: isMahasiswa ? null : (scoredItem.gradedBy ?? null),
						createdAt: BigInt(scoredItem.createdAt),
					};
					const createData: any = { ...updateData, id: scoredItem.id };

					if (isMahasiswa) {
						// Re-check existing session state inside the transaction to eliminate the
						// TOCTOU race condition where a supervisor's forceSubmit happens concurrently.
						const existingInTx = await tx.sesiUjian.findUnique({
							where: { id: scoredItem.id },
							select: { status: true },
						});
						if (existingInTx && existingInTx.status === "selesai") {
							// The exam has already been marked as finished; reject overwrite.
							return;
						}

						// Keep participant writes narrow: only fields a running
						// session may legitimately change. skorTotal/maxSkor are
						// server-computed above, so they are trusted.
						updateData = {
							status: scoredItem.status,
							selesaiAt: toBigInt(scoredItem.selesaiAt),
							jawaban: stringifyJson(scoredItem.jawaban),

							pelanggaran: scoredItem.pelanggaran,
							skorTotal: scoredItem.skorTotal ?? null,
							maxSkor: scoredItem.maxSkor ?? null,
						};
						createData.gradedAt = null;
						createData.gradedBy = null;
					}

					await tx.sesiUjian.upsert({
						where: { id: scoredItem.id },
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
