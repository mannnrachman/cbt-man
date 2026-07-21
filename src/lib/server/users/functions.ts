import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { deleteSessionsForUser } from "../db/session";
import { requireCaller, requireAdminResult, seedIfNeeded } from "../db/auth";
import { hashPassword } from "@/lib/cbt/hash";
import { stringifyJson } from "../db/json";
import { publicUser, upsertUserSchema } from "../repos/mappers";
import type { User, Group } from "@/lib/cbt/types";
import { writeAuditLog } from "../db/audit";

export const revokeUserSessionsServer = createServerFn({ method: "POST" })
	.validator(z.object({ userId: z.string().min(1) }))
	.handler(async ({ data }) => {
		const caller = await requireCaller();
		if (!caller || caller.role !== "super_admin") {
			return { ok: false as const, error: "Forbidden", deleted: 0 };
		}
		const deleted = await deleteSessionsForUser(data.userId);
		return { ok: true as const, deleted };
	});

export const upsertUserServer = createServerFn({ method: "POST" })
	.validator(upsertUserSchema)
	.handler(async ({ data }) => {
		try {
			await seedIfNeeded();
			const caller = await requireCaller();
			if (!caller || caller.role !== "super_admin") {
				return { ok: false as const, error: "Forbidden" };
			}

			const existing = await prisma.user.findUnique({ where: { id: data.id } });
			if (!existing && !data.newPassword) {
				return {
					ok: false as const,
					error: "Password wajib diisi untuk akun baru",
				};
			}

			const passwordHash = data.newPassword
				? await hashPassword(data.newPassword)
				: (existing?.passwordHash ?? "");

			const saved = await prisma.user.upsert({
				where: { id: data.id },
				update: {
					username: data.username,
					passwordHash,
					namaLengkap: data.namaLengkap,
					role: data.role,
					allowedTopikIds: stringifyJson(data.allowedTopikIds),
					groupId: data.groupId ?? null,
					prodiId: data.prodiId ?? null,
					mataKuliahIds: stringifyJson(data.mataKuliahIds),
					detail: data.detail ?? null,
					aktif: data.aktif,
				},
				create: {
					id: data.id,
					username: data.username,
					passwordHash,
					namaLengkap: data.namaLengkap,
					role: data.role,
					allowedTopikIds: stringifyJson(data.allowedTopikIds),
					groupId: data.groupId ?? null,
					prodiId: data.prodiId ?? null,
					mataKuliahIds: stringifyJson(data.mataKuliahIds),
					detail: data.detail ?? null,
					aktif: data.aktif,
					createdAt: BigInt(data.createdAt ?? Date.now()),
				},
			});

			if (existing?.aktif === true && data.aktif === false) {
				await deleteSessionsForUser(data.id);
			}

			return { ok: true as const, user: publicUser(saved) };
		} catch (err) {
			return {
				ok: false as const,
				error: err instanceof Error ? err.message : String(err),
			};
		}
	});

export const mutateUserServer = createServerFn({ method: "POST" })
	.validator(
		z.object({
			action: z.enum(["upsert", "remove", "bulkSet"]),
			payload: z.any(),
		}),
	)
	.handler(async ({ data }) => {
		try {
			await seedIfNeeded();
			const auth = await requireAdminResult();
			if (!auth.ok) return { ok: false as const, error: auth.error };
			const caller = await requireCaller();
			const { action, payload } = data;

			if (caller) {
				writeAuditLog({
					userId: caller.id,
					userRole: caller.role,
					action: `users.${action}`,
					entity: "users",
					entityId: typeof payload === "object" && payload && "id" in payload
							? String((payload as { id?: unknown }).id ?? "")
							: undefined,
					details: JSON.stringify({ entity: "users", action, hasPayload: !!payload }),
				}).catch(() => undefined);
			}

			await prisma.$transaction(async (tx) => {
				if (action === "remove")
					await tx.user.delete({ where: { id: String(payload.id) } });
				else if (action === "bulkSet") {
					await tx.user.deleteMany();
					for (const item of payload as User[]) {
						await tx.user.create({
							data: {
								...item,
								allowedTopikIds: stringifyJson(item.allowedTopikIds),
								groupId: item.groupId ?? null,
								prodiId: item.prodiId ?? null,
								mataKuliahIds: stringifyJson(item.mataKuliahIds),
								detail: item.detail ?? null,
								createdAt: BigInt(item.createdAt),
							},
						});
					}
				} else {
					const item = payload as User;
					const prev = await tx.user.findUnique({
						where: { id: item.id },
						select: { aktif: true, passwordHash: true },
					});
					if (!prev && !item.passwordHash) {
						throw new Error("Password wajib diisi untuk akun baru");
					}
					const nextPasswordHash = item.passwordHash || prev?.passwordHash || "";
					await tx.user.upsert({
						where: { id: item.id },
						update: {
							username: item.username,
							passwordHash: nextPasswordHash,
							namaLengkap: item.namaLengkap,
							role: item.role,
							allowedTopikIds: stringifyJson(item.allowedTopikIds),
							groupId: item.groupId ?? null,
							prodiId: item.prodiId ?? null,
							mataKuliahIds: stringifyJson(item.mataKuliahIds),
							detail: item.detail ?? null,
							aktif: item.aktif,
						},
						create: {
							id: item.id,
							username: item.username,
							passwordHash: nextPasswordHash,
							namaLengkap: item.namaLengkap,
							role: item.role,
							allowedTopikIds: stringifyJson(item.allowedTopikIds),
							groupId: item.groupId ?? null,
							prodiId: item.prodiId ?? null,
							mataKuliahIds: stringifyJson(item.mataKuliahIds),
							detail: item.detail ?? null,
							aktif: item.aktif,
							createdAt: BigInt(item.createdAt),
						},
					});
					if (prev?.aktif === true && item.aktif === false) {
						await tx.session.deleteMany({ where: { userId: item.id } });
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

export const mutateGroupServer = createServerFn({ method: "POST" })
	.validator(
		z.object({
			action: z.enum(["upsert", "remove", "bulkSet"]),
			payload: z.any(),
		}),
	)
	.handler(async ({ data }) => {
		try {
			await seedIfNeeded();
			const auth = await requireAdminResult();
			if (!auth.ok) return { ok: false as const, error: auth.error };
			const caller = await requireCaller();
			const { action, payload } = data;

			if (caller) {
				writeAuditLog({
					userId: caller.id,
					userRole: caller.role,
					action: `groups.${action}`,
					entity: "groups",
					entityId: typeof payload === "object" && payload && "id" in payload
							? String((payload as { id?: unknown }).id ?? "")
							: undefined,
					details: JSON.stringify({ entity: "groups", action, hasPayload: !!payload }),
				}).catch(() => undefined);
			}

			await prisma.$transaction(async (tx) => {
				if (action === "remove")
					await tx.group.delete({ where: { id: String(payload.id) } });
				else if (action === "bulkSet") {
					await tx.group.deleteMany();
					await tx.group.createMany({ data: payload as Group[] });
				} else
					await tx.group.upsert({
						where: { id: payload.id },
						update: payload,
						create: payload,
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
