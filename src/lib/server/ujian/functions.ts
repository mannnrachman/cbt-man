/* eslint-disable @typescript-eslint/no-explicit-any */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { 
	requireCaller, 
	requireAdminResult,
	seedIfNeeded,
	operatorHasNav,
	operatorCanTouchUjian,
	operatorCanTouchTopicSets,
	pesertaCanTouchUjian,
	allowedTopikIdsForCaller
} from "../db/auth";
import type { Ujian, TokenUjian } from "@/lib/cbt/types";
import { writeAuditLog } from "../db/audit";
import { Prisma } from "@prisma/client";
import { stringifyJson, toBigInt, parseJson } from "../db/json";
import { mapToken, mapUjian } from "../repos/mappers";
import { uid } from "../db/id.server";
import { randomBytes } from "node:crypto";
import { checkRateLimit, clearRateLimit } from "@/lib/cbt/rate-limit";
import { getRequestIP } from "@tanstack/start-server-core";
import { ipInRanges } from "@/lib/cbt/cidr";

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

export const mutateUjianServer = createServerFn({ method: "POST" })
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
				if (!(await operatorHasNav(caller, "ujian")))
					return { ok: false as const, error: "Forbidden" };
				if (action === "remove") {
					const id = String((payload as { id?: string }).id ?? "");
					if (!(await operatorCanTouchUjian(caller, id))) return { ok: false as const, error: "Forbidden" };
				} else {
					const item = payload as Ujian;
					if (!(await operatorCanTouchTopicSets(caller, item.topicSets))) return { ok: false as const, error: "Forbidden" };
				}
			} else if (caller.role !== "super_admin") {
				return { ok: false as const, error: "Forbidden" };
			}

			audit(caller, "ujian", action, payload);

			await prisma.$transaction(async (tx) => {
				if (action === "remove")
					await tx.ujian.delete({ where: { id: String(payload.id) } });
				else if (action === "bulkSet") {
					await tx.ujian.deleteMany();
					for (const item of payload as Ujian[]) {
						await tx.ujian.create({
							data: {
								...item,
								beginAt: toBigInt(item.beginAt),
								endAt: toBigInt(item.endAt),
								groupIds: stringifyJson(item.groupIds),
								topicSets: stringifyJson(item.topicSets),
								createdAt: BigInt(item.createdAt),
							},
						});
					}
				} else {
					const item = payload as Ujian;
					await tx.ujian.upsert({
						where: { id: item.id },
						update: {
							...item,
							beginAt: toBigInt(item.beginAt),
							endAt: toBigInt(item.endAt),
							groupIds: stringifyJson(item.groupIds),
							topicSets: stringifyJson(item.topicSets),
							createdAt: BigInt(item.createdAt),
						},
						create: {
							...item,
							beginAt: toBigInt(item.beginAt),
							endAt: toBigInt(item.endAt),
							groupIds: stringifyJson(item.groupIds),
							topicSets: stringifyJson(item.topicSets),
							createdAt: BigInt(item.createdAt),
						},
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

export const mutateTokenServer = createServerFn({ method: "POST" })
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
				if (!(await operatorHasNav(caller, "ujian")))
					return { ok: false as const, error: "Forbidden" };
				const id = action === "remove" ? undefined : (payload as TokenUjian).ujianId;
				if (id) {
					if (!(await operatorCanTouchUjian(caller, id))) return { ok: false as const, error: "Forbidden" };
				} else {
					const existing = await prisma.tokenUjian.findUnique({
						where: { id: String((payload as { id?: string }).id ?? "") },
						select: { ujianId: true },
					});
					if (!existing || !(await operatorCanTouchUjian(caller, existing.ujianId))) {
						return { ok: false as const, error: "Forbidden" };
					}
				}
			} else if (caller.role !== "super_admin") {
				return { ok: false as const, error: "Forbidden" };
			}

			// Don't audit token crud

			await prisma.$transaction(async (tx) => {
				if (action === "remove")
					await tx.tokenUjian.delete({ where: { id: String(payload.id) } });
				else if (action === "bulkSet") {
					await tx.tokenUjian.deleteMany();
					await tx.tokenUjian.createMany({
						data: (payload as TokenUjian[]).map((item) => ({
							...item,
							dipakaiOleh: item.dipakaiOleh ?? null,
							dipakaiAt: toBigInt(item.dipakaiAt),
						})),
					});
				} else {
					const item = payload as TokenUjian;
					await tx.tokenUjian.upsert({
						where: { id: item.id },
						update: {
							ujianId: item.ujianId,
							kode: item.kode,
							dipakaiOleh: item.dipakaiOleh ?? null,
							dipakaiAt: toBigInt(item.dipakaiAt),
						},
						create: {
							id: item.id,
							ujianId: item.ujianId,
							kode: item.kode,
							dipakaiOleh: item.dipakaiOleh ?? null,
							dipakaiAt: toBigInt(item.dipakaiAt),
						},
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

const TOKEN_CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; 
const DEFAULT_TOKEN_LENGTH = 12;
const MAX_TOKEN_COLLISION_RETRIES = 5;

function generateTokenCode(length: number = DEFAULT_TOKEN_LENGTH): string {
	const bytes = randomBytes(length);
	let out = "";
	for (let i = 0; i < length; i++) {
		const byte = bytes[i];
		if (byte === undefined) throw new Error("randomBytes returned short buffer");
		out += TOKEN_CHARSET.charAt(byte % TOKEN_CHARSET.length);
	}
	return out;
}

export function isValidTokenCode(code: string): boolean {
	if (code.length === 0) return false;
	for (const ch of code) {
		if (!TOKEN_CHARSET.includes(ch)) return false;
	}
	return true;
}

export const generateExamTokensServer = createServerFn({ method: "POST" })
	.validator(
		z.object({
			ujianId: z.string().min(1),
			jumlah: z.number().int().min(1).max(500),
			length: z.number().int().min(8).max(32).optional(),
		}),
	)
	.handler(async ({ data }) => {
		await seedIfNeeded();
		const caller = await requireCaller();
		if (!caller) return { ok: false as const, error: "Unauthorized" };
		if (caller.role !== "super_admin" && caller.role !== "admin_prodi") {
			return { ok: false as const, error: "Forbidden" };
		}

		if (caller.role === "admin_prodi") {
			if (!(await operatorCanTouchUjian(caller, data.ujianId))) {
				return { ok: false as const, error: "Forbidden" };
			}
		}

		const exam = await prisma.ujian.findUnique({ where: { id: data.ujianId } });
		if (!exam) return { ok: false as const, error: "Ujian tidak ditemukan" };

		const length = data.length ?? DEFAULT_TOKEN_LENGTH;
		const created: TokenUjian[] = [];
		let attempts = 0;
		const maxAttempts = data.jumlah * (1 + MAX_TOKEN_COLLISION_RETRIES);

		while (created.length < data.jumlah && attempts < maxAttempts) {
			const code = generateTokenCode(length);
			attempts++;
			try {
				const row = await prisma.tokenUjian.create({
					data: {
						id: uid("tk_"),
						ujianId: data.ujianId,
						kode: code,
					},
				});
				created.push(mapToken(row));
			} catch (err) {
				if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
					continue;
				}
				throw err;
			}
		}

		if (created.length < data.jumlah) {
			return {
				ok: false as const,
				error: `Gagal membuat token unik setelah ${maxAttempts} percobaan; berhasil ${created.length} dari ${data.jumlah}`,
				created: created.length,
			};
		}

		return { ok: true as const, tokens: created };
	});

export const claimExamToken = createServerFn({ method: "POST" })
	.validator(
		z.object({
			ujianId: z.string().min(1),
			kode: z.string().min(1),
		}),
	)
	.handler(async ({ data }) => {
		const caller = await requireCaller();
		if (!caller) return { ok: false as const, error: "Unauthorized" };
		if (caller.role !== "mahasiswa")
			return { ok: false as const, error: "Forbidden" };
		if (!(await pesertaCanTouchUjian(caller, data.ujianId))) {
			return { ok: false as const, error: "Forbidden" };
		}

		const rateCheck = checkRateLimit(caller.id, "claimToken");
		if (!rateCheck.ok) {
			return { ok: false as const, error: rateCheck.error };
		}

		const ujian = await prisma.ujian.findUnique({
			where: { id: data.ujianId },
			select: { ipRange: true },
		});
		if (ujian?.ipRange) {
			const ip = getRequestIP({ xForwardedFor: true }) ?? "unknown";
			if (!ipInRanges(ip, ujian.ipRange)) {
				return {
					ok: false as const,
					error: "Akses ditolak: IP Anda tidak diizinkan untuk ujian ini.",
				};
			}
		}

		const kode = data.kode.trim().toUpperCase();
		const dipakaiAt = Date.now();

		const result = await prisma.tokenUjian.updateMany({
			where: {
				ujianId: data.ujianId,
				kode,
				OR: [{ dipakaiOleh: null }, { dipakaiOleh: caller.id }],
			},
			data: { dipakaiOleh: caller.id, dipakaiAt: toBigInt(dipakaiAt) },
		});

		if (result.count === 0) {
			const existing = await prisma.tokenUjian.findFirst({
				where: { ujianId: data.ujianId, kode },
				select: { id: true },
			});
			if (!existing)
				return {
					ok: false as const,
					error: "Token tidak valid untuk ujian ini",
				};
			return { ok: false as const, error: "Token sudah dipakai peserta lain" };
		}

		const claimedId = await prisma.tokenUjian.findFirst({
			where: { ujianId: data.ujianId, kode },
			select: { id: true },
		});
		if (!claimedId) {
			return {
				ok: false as const,
				error: "Token tidak dapat diklaim, silakan coba lagi",
			};
		}
		const token: TokenUjian = {
			id: claimedId.id,
			ujianId: data.ujianId,
			kode,
			dipakaiOleh: caller.id,
			dipakaiAt,
		};
		clearRateLimit(caller.id, "claimToken");
		return { ok: true as const, token };
	});

export const fetchUjianByIdServer = createServerFn({ method: "POST" })
	.validator(z.object({ id: z.string().min(1) }))
	.handler(async ({ data }) => {
		await seedIfNeeded();
		const caller = await requireCaller();
		if (!caller) return { ok: false as const, error: "Unauthorized" };

		const row = await prisma.ujian.findUnique({ where: { id: data.id } });
		if (!row) return { ok: false as const, error: "Not found" };

		if (caller.role === "admin_prodi" || caller.role === "evaluator") {
			const allowed = allowedTopikIdsForCaller(caller);
			if (allowed) {
				const sets = parseJson<{ topikId: string }[]>(row.topicSets, []);
				const topicIds = new Set(sets.map((s) => s.topikId));
				const any = [...topicIds].some((id) => allowed.has(id));
				if (!any) return { ok: false as const, error: "Forbidden" };
			}
		} else if (caller.role === "mahasiswa") {
			const groupIds = parseJson<string[]>(row.groupIds, []);
			if (
				groupIds.length > 0 &&
				(!caller.unitId || !groupIds.includes(caller.unitId))

			) {
				return { ok: false as const, error: "Forbidden" };
			}
		}

		return { ok: true as const, ujian: mapUjian(row) };
	});

export const saveConfigServer = createServerFn({ method: "POST" })
	.validator(
		z.object({
			appName: z.string(),
			appLogo: z.string().optional(),
			appDeskripsi: z.string(),
			pesanLogin: z.string(),
			mobileLock: z.boolean(),
			multiDevice: z.boolean(),
			roleAccess: z.record(z.string(), z.array(z.string())),
		}),
	)
	.handler(async ({ data }) => {
		try {
			const auth = await requireAdminResult();
			if (!auth.ok) return { ok: false as const, error: auth.error };
			await prisma.appConfig.upsert({
				where: { id: "app" },
				update: { ...data, roleAccess: stringifyJson(data.roleAccess) },
				create: {
					id: "app",
					...data,
					roleAccess: stringifyJson(data.roleAccess),
				},
			});
			return { ok: true as const };
		} catch (err) {
			return {
				ok: false as const,
				error: err instanceof Error ? err.message : String(err),
			};
		}
	});
