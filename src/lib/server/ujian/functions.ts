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

async function getPublishError(item: Ujian, db: any = prisma): Promise<string | null> {
	if (item.status !== "draft") return "Paket ujian sudah dipublikasikan.";
	if (item.topicSets.length === 0) return "Tambahkan minimal satu sumber soal.";
	if (item.beginAt === undefined || item.endAt === undefined) return "Atur waktu mulai dan selesai.";
	if (item.endAt <= item.beginAt) return "Waktu selesai harus setelah waktu mulai.";
	if (!item.penawaranId) return "Pilih kelas mata kuliah.";
	const penawaran = await db.penawaranMataKuliah.findUnique({ where: { id: item.penawaranId } });
	if (!penawaran || penawaran.mataKuliahId !== item.mataKuliahId || (penawaran.semesterId ?? undefined) !== item.semesterId) {
		return "Kelas mata kuliah tidak sesuai dengan paket.";
	}
	if (item.groupIds.length === 0 && parseJson<string[]>(penawaran.pesertaIds, []).length === 0) return "Pilih peserta pada kelas mata kuliah.";
	const topikIds = item.topicSets.map((set) => set.topikId);
	if (new Set(topikIds).size !== topikIds.length) return "Topik sumber soal tidak boleh duplikat.";
	const topiks: any[] = await db.topik.findMany({
		where: { id: { in: topikIds } },
		include: { modul: true, soal: true },
	});
	const topikById = new Map(topiks.map((topik) => [topik.id, topik]));
	for (const set of item.topicSets) {
		if (!Number.isInteger(set.jumlah) || set.jumlah < 1) return "Jumlah soal harus bilangan bulat positif.";
		const topik = topikById.get(set.topikId);
		if (!topik) return "Ada topik sumber soal yang tidak ditemukan.";
		const topikMataKuliahId = topik.mataKuliahId ?? topik.modul?.mataKuliahId;
		if (item.mataKuliahId && topikMataKuliahId !== item.mataKuliahId) {
			return `Topik "${topik.nama}" bukan bagian dari mata kuliah paket.`;
		}
		const pool = topik.soal.filter((soal: any) =>
			(!set.tipe || soal.tipe === set.tipe) && (!set.kesulitan || soal.kesulitan === set.kesulitan),
		);
		if (pool.length < set.jumlah) return `Soal pada topik "${topik.nama}" belum mencukupi.`;
	}
	return null;
}

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

function validateUjianForSave(item: Ujian) {
	if (!item.nama.trim()) throw new Error("Nama paket ujian wajib diisi.");
	if (!Number.isInteger(item.durasiMenit) || item.durasiMenit < 1) {
		throw new Error("Durasi paket ujian harus minimal 1 menit.");
	}
	if (item.beginAt !== undefined && item.endAt !== undefined && item.endAt <= item.beginAt) {
		throw new Error("Waktu selesai harus setelah waktu mulai.");
	}
	if (item.topicSets.some((set) => !Number.isInteger(set.jumlah) || set.jumlah < 1)) {
		throw new Error("Jumlah soal pada setiap sumber harus minimal 1.");
	}
}

export const mutateUjianServer = createServerFn({ method: "POST" })
	.validator(
		z.object({
			action: z.enum(["upsert", "remove", "bulkSet", "publish"]),
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
				if (action === "remove" || action === "publish") {
					const id = String((payload as { id?: string }).id ?? "");
					if (!(await operatorCanTouchUjian(caller, id))) return { ok: false as const, error: "Forbidden" };
				} else {
					const item = payload as Ujian;
					const existing = await prisma.ujian.findUnique({ where: { id: item.id }, select: { id: true } });
					if (existing
						? !(await operatorCanTouchUjian(caller, item.id))
						: !(await operatorCanTouchTopicSets(caller, item.topicSets))) return { ok: false as const, error: "Forbidden" };
				}
			} else if (caller.role !== "super_admin") {
				return { ok: false as const, error: "Forbidden" };
			}

			audit(caller, "ujian", action, payload);

			await prisma.$transaction(async (tx) => {
				if (action === "publish") {
					const row = await tx.ujian.findUnique({ where: { id: String(payload.id) } });
					if (!row) throw new Error("Ujian tidak ditemukan.");
					if (row.status !== "draft") throw new Error("Paket ujian sudah dipublikasikan.");
					if (await tx.sesiUjian.count({ where: { ujianId: row.id } }) > 0) {
						throw new Error("Paket tidak dapat dipublikasikan karena sudah memiliki sesi peserta.");
					}
					const error = await getPublishError(mapUjian(row), tx);
					if (error) throw new Error(error);
					const updated = await tx.ujian.updateMany({ where: { id: row.id, status: "draft" }, data: { status: "published" } });
					if (updated.count !== 1) throw new Error("Paket ujian sudah dipublikasikan.");
				} else if (action === "remove")
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
					validateUjianForSave(item);
					const existing = await tx.ujian.findUnique({
						where: { id: item.id },
						select: { id: true, status: true, createdAt: true },
					});
					if (existing?.status === "published") throw new Error("Paket published hanya dapat diubah melalui alur revisi.");
					if (existing && await tx.sesiUjian.count({ where: { ujianId: item.id } }) > 0) {
						throw new Error("Paket tidak dapat diubah karena sudah memiliki sesi peserta.");
					}
					const writeData = {
						nama: item.nama,
						deskripsi: item.deskripsi,
						durasiMenit: item.durasiMenit,
						poinBenar: item.poinBenar,
						poinSalah: item.poinSalah,
						poinKosong: item.poinKosong,
						beginAt: toBigInt(item.beginAt),
						endAt: toBigInt(item.endAt),
						tokenAktif: item.tokenAktif,
						ipRange: item.ipRange,
						groupIds: stringifyJson(item.groupIds),
						mataKuliahId: item.mataKuliahId ?? null,
						semesterId: item.semesterId ?? null,
						penawaranId: item.penawaranId ?? null,
						topicSets: stringifyJson(item.topicSets),
						showResult: item.showResult,
						showResultDetail: item.showResultDetail,
						fullscreenWajib: item.fullscreenWajib,
						maxPindahTab: item.maxPindahTab,
						blokirShortcut: item.blokirShortcut,
						mode: item.mode,
						allowCalculator: item.allowCalculator,
						allowNilaiNormal: item.allowNilaiNormal,
					};
					if (existing) {
						const updated = await tx.ujian.updateMany({ where: { id: item.id, status: "draft" }, data: writeData });
						if (updated.count !== 1) throw new Error("Paket ujian sudah dipublikasikan.");
					} else {
						await tx.ujian.create({
							data: {
								id: item.id,
								...writeData,
								status: "draft",
								createdBy: caller.id,
								createdAt: BigInt(Date.now()),
							},
						});
					}
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
			jumlah: z.number().int().min(1).max(500).default(10),
			length: z.number().int().min(4).max(32).optional(),
			customKode: z.string().trim().min(1).max(30).optional(),
			expireAtMs: z.number().int().positive().optional(),
			applyToAll: z.boolean().optional(),
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

		let targetUjianIds = [data.ujianId];
		if (data.applyToAll) {
			const allUjians = await prisma.ujian.findMany({ select: { id: true } });
			if (caller.role === "super_admin") {
				targetUjianIds = allUjians.map((u) => u.id);
			} else {
				targetUjianIds = [];
				for (const u of allUjians) {
					if (await operatorCanTouchUjian(caller, u.id)) {
						targetUjianIds.push(u.id);
					}
				}
			}
		}

		const expireAt = data.expireAtMs ? toBigInt(data.expireAtMs) : null;
		const created: TokenUjian[] = [];

		if (data.customKode) {
			const code = data.customKode.trim().toUpperCase();
			const tokens = await prisma.$transaction(async (tx) => {
				const rows = [];
				for (const ujianId of targetUjianIds) {
					rows.push(
						await tx.tokenUjian.upsert({
							where: { ujianId_kode: { ujianId, kode: code } },
							create: { id: uid("tk_"), ujianId, kode: code, expireAt },
							update: { expireAt },
						}),
					);
				}
				return rows;
			});
			return { ok: true as const, tokens: tokens.filter((token) => token.ujianId === data.ujianId).map(mapToken) };
		}

		const length = data.length ?? DEFAULT_TOKEN_LENGTH;
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
						expireAt,
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

export const deleteExamTokenServer = createServerFn({ method: "POST" })
	.validator(z.object({ id: z.string().min(1) }))
	.handler(async ({ data }) => {
		try {
			await seedIfNeeded();
			const caller = await requireCaller();
			if (!caller) return { ok: false as const, error: "Unauthorized" };
			if (caller.role !== "super_admin" && caller.role !== "admin_prodi") {
				return { ok: false as const, error: "Forbidden" };
			}

			const token = await prisma.tokenUjian.findUnique({
				where: { id: data.id },
				select: { ujianId: true },
			});
			if (!token) return { ok: false as const, error: "Token tidak ditemukan" };

			if (caller.role === "admin_prodi") {
				if (!(await operatorCanTouchUjian(caller, token.ujianId))) {
					return { ok: false as const, error: "Forbidden" };
				}
			}

			await prisma.tokenUjian.delete({ where: { id: data.id } });
			return { ok: true as const };
		} catch (err) {
			return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
		}
	});

export const claimExamToken = createServerFn({ method: "POST" })
	.validator(
		z.object({
			ujianId: z.string().min(1),
			kode: z.string().trim().min(1).max(30),
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
		const now = Date.now();

		const token = await prisma.tokenUjian.findFirst({
			where: {
				ujianId: data.ujianId,
				kode,
			},
		});

		if (!token) {
			return { ok: false as const, error: "Token tidak valid untuk ujian ini" };
		}

		if (token.expireAt) {
			const expireMs = Number(token.expireAt);
			if (now > expireMs) {
				return { ok: false as const, error: "Token sudah kedaluwarsa" };
			}
		}

		// Reusable / Master token claim: atomic upsert to TokenClaim
		await prisma.tokenClaim.upsert({
			where: {
				ujianId_pesertaId: { ujianId: data.ujianId, pesertaId: caller.id },
			},
			create: {
				id: uid("tc_"),
				ujianId: data.ujianId,
				pesertaId: caller.id,
				kode,
				claimedAt: BigInt(now),
			},
			update: {
				kode,
				claimedAt: BigInt(now),
			},
		});

		// Also update legacy single-use token field if not claimed by another
		if (!token.dipakaiOleh || token.dipakaiOleh === caller.id) {
			await prisma.tokenUjian.update({
				where: { id: token.id },
				data: { dipakaiOleh: caller.id, dipakaiAt: BigInt(now) },
			});
		}

		clearRateLimit(caller.id, "claimToken");
		return {
			ok: true as const,
			token: mapToken(token),
		};
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
			if (!(await operatorCanTouchUjian(caller, row.id))) return { ok: false as const, error: "Forbidden" };
		} else if (caller.role === "mahasiswa") {
			if (!(await pesertaCanTouchUjian(caller, row.id))) return { ok: false as const, error: "Forbidden" };
		}

		return { ok: true as const, ujian: mapUjian(row) };
	});

export const getFullConfigServer = createServerFn({ method: "GET" }).handler(
	async () => {
		const caller = await requireCaller();
		if (!caller || caller.role !== "super_admin") return null;
		const row = await prisma.appConfig.findUnique({ where: { id: "app" } });
		if (!row) return null;
		return {
			appName: row.appName,
			appLogo: row.appLogo,
			appDeskripsi: row.appDeskripsi,
			pesanLogin: row.pesanLogin,
			mobileLock: row.mobileLock,
			multiDevice: row.multiDevice,
			roleAccess: parseJson<Record<string, string[]>>(row.roleAccess, {}),
		};
	}
);export const getUjiansList = createServerFn({ method: "GET" }).handler(
	async () => {
		const caller = await requireCaller();
		if (!caller || caller.role === "mahasiswa") return [];
		const rows = await prisma.ujian.findMany();
		return rows.map(mapUjian);
	}
);
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
