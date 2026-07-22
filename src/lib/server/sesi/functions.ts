/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { 
	requireCaller, 
	seedIfNeeded,
	operatorHasAnyNav,
	operatorCanTouchUjian,
	pesertaCanTouchUjian
} from "../db/auth";
import type { SesiUjian, NavKey } from "@/lib/cbt/types";
import { writeAuditLog } from "../db/audit";
import { stringifyJson, toBigInt, toNumber } from "../db/json";
import { getRequestIP } from "@tanstack/start-server-core";
import { ipInRanges } from "@/lib/cbt/cidr";

const OPERATOR_SESSION_KEYS: NavKey[] = [
	"ujian",
	"hasil",
	"evaluasi",
	"laporan",
	"leaderboard",
];

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
					select: { pesertaId: true, ujianId: true },
				});
				if (
					existing &&
					(existing.pesertaId !== caller.id || existing.ujianId !== item.ujianId)
				) {
					return { ok: false as const, error: "Forbidden" };
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
						const claimed = await prisma.tokenUjian.findFirst({
							where: { ujianId: item.ujianId, dipakaiOleh: caller.id },
						});
						if (!claimed) {
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
					
					let sanitizedJawaban = item.jawaban;
					if (caller.role === "mahasiswa") {
						sanitizedJawaban = (item.jawaban || []).map((j: any) => ({
							...j,
							skor: undefined,
							catatanGrader: undefined,
						}));
					}

					let updateData: any = {
						ujianId: item.ujianId,
						pesertaId: item.pesertaId,
						status: item.status,
						mulaiAt: toBigInt(item.mulaiAt),
						selesaiAt: toBigInt(item.selesaiAt),
						endsAt: toBigInt(item.endsAt),
						soalIds: stringifyJson(item.soalIds),
						jawabanOrder: stringifyJson(item.jawabanOrder),
						jawaban: stringifyJson(sanitizedJawaban),
						pelanggaran: item.pelanggaran,
						skorTotal: item.skorTotal ?? null,
						maxSkor: item.maxSkor ?? null,
						gradedAt: toBigInt(item.gradedAt),
						gradedBy: item.gradedBy ?? null,
						createdAt: BigInt(item.createdAt),
					};
					const createData: any = { ...updateData, id: item.id };

					if (caller.role === "mahasiswa") {
						updateData = {
							status: item.status,
							selesaiAt: toBigInt(item.selesaiAt),
							jawaban: stringifyJson(sanitizedJawaban),
							pelanggaran: item.pelanggaran,
						};
						createData.skorTotal = null;
						createData.maxSkor = null;
						createData.gradedAt = null;
						createData.gradedBy = null;
					}

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
