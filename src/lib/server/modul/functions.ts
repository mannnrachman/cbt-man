/* eslint-disable @typescript-eslint/no-explicit-any */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { 
	requireCaller, 
	seedIfNeeded,
	operatorHasNav,
	allowedTopikIdsForCaller,
	operatorCanTouchSoal,
	operatorCanTouchTopikId
} from "../db/auth";
import type { Topik, Soal } from "@/lib/cbt/types";
import { writeAuditLog } from "../db/audit";

function audit(caller: any, entity: string, action: string, payload: any) {
	if (caller) {
		writeAuditLog({
			userId: caller.id,
			userRole: caller.role,
			action: `${entity}.${action}`,
			entity,
			entityId: typeof payload === "object" && payload && "id" in payload
					? String((payload as { id?: unknown }).id ?? "")
					: undefined,
			details: JSON.stringify({ entity, action, hasPayload: !!payload }),
		}).catch(() => undefined);
	}
}



export const mutateTopikServer = createServerFn({ method: "POST" })
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
			
			if (caller.role === "admin_prodi") {
				if (!(await operatorHasNav(caller, "modul")))
					return { ok: false as const, error: "Forbidden" };
				if (action === "bulkSet") return { ok: false as const, error: "Forbidden" };
				if (allowedTopikIdsForCaller(caller) !== null) return { ok: false as const, error: "Forbidden" };
			} else if (caller.role !== "super_admin") {
				return { ok: false as const, error: "Forbidden" };
			}

			audit(caller, "topik", action, payload);

			await prisma.$transaction(async (tx) => {
				if (action === "remove")
					await tx.topik.delete({ where: { id: String(payload.id) } });
				else if (action === "bulkSet") {
					await tx.topik.deleteMany();
					await tx.topik.createMany({ data: payload as any });
				} else
					await tx.topik.upsert({
						where: { id: payload.id },
						update: payload as any,
						create: payload as any,
					});
			});
			return { ok: true as const };
		} catch (err) {
			return {
				ok: false as const,
				error: err instanceof Error ? err.message : String(err),
			};
		}
	});

export const mutateSoalServer = createServerFn({ method: "POST" })
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
			
			if (caller.role === "admin_prodi") {
				if (!(await operatorHasNav(caller, "modul")))
					return { ok: false as const, error: "Forbidden" };
				if (action === "bulkSet") return { ok: false as const, error: "Forbidden" };
				if (action === "remove") {
					const id = String((payload as { id?: string }).id ?? "");
					if (!(await operatorCanTouchSoal(caller, id))) return { ok: false as const, error: "Forbidden" };
				} else {
					const item = payload as Soal;
					if (!operatorCanTouchTopikId(caller, item.topikId)) return { ok: false as const, error: "Forbidden" };
				}
			} else if (caller.role !== "super_admin") {
				return { ok: false as const, error: "Forbidden" };
			}

			audit(caller, "soal", action, payload);

			await prisma.$transaction(async (tx) => {
				if (action === "remove")
					await tx.soal.delete({ where: { id: String(payload.id) } });
				else if (action === "bulkSet") {
					await tx.jawaban.deleteMany();
					await tx.soal.deleteMany();
					for (const item of payload as Soal[]) {
						await tx.soal.create({
							data: {
								id: item.id,
								topikId: item.topikId,
								detail: item.detail,
								tipe: item.tipe,
								kesulitan: item.kesulitan,
								audioFileId: item.audioFileId ?? null,
								audioPlayOnce: item.audioPlayOnce,
								pembahasan: item.pembahasan,
								createdAt: BigInt(item.createdAt),
								jawaban: { create: item.jawaban },
							},
						});
					}
				} else {
					const item = payload as Soal;
					await tx.soal.upsert({
						where: { id: item.id },
						update: {
							topikId: item.topikId,
							detail: item.detail,
							tipe: item.tipe,
							kesulitan: item.kesulitan,
							audioFileId: item.audioFileId ?? null,
							audioPlayOnce: item.audioPlayOnce,
							pembahasan: item.pembahasan,
							createdAt: BigInt(item.createdAt),
						},
						create: {
							id: item.id,
							topikId: item.topikId,
							detail: item.detail,
							tipe: item.tipe,
							kesulitan: item.kesulitan,
							audioFileId: item.audioFileId ?? null,
							audioPlayOnce: item.audioPlayOnce,
							pembahasan: item.pembahasan,
							createdAt: BigInt(item.createdAt),
						},
					});
					await tx.jawaban.deleteMany({ where: { soalId: item.id } });
					await tx.jawaban.createMany({
						data: item.jawaban.map((jawaban) => ({
							...jawaban,
							soalId: item.id,
						})),
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



export const getTopiksList = createServerFn({ method: "GET" }).handler(
	async () => {
		const caller = await requireCaller();
		if (!caller || caller.role === "mahasiswa") return [];
		return prisma.topik.findMany();
	}
);
