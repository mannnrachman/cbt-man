/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { requireCaller, seedIfNeeded } from "../db/auth";
import { writeAuditLog } from "../db/audit";
import type { Fakultas, Jurusan, ProgramStudi, TahunAkademik, Semester, MataKuliah } from "@/lib/cbt/types";

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

async function requireSuperAdmin() {
	await seedIfNeeded();
	const caller = await requireCaller();
	if (!caller || caller.role !== "super_admin") {
		return null;
	}
	return caller;
}

export const mutateFakultasServer = createServerFn({ method: "POST" })
	.validator(z.object({ action: z.enum(["upsert", "remove"]), payload: z.any() }))
	.handler(async ({ data }) => {
		try {
			const caller = await requireSuperAdmin();
			if (!caller) return { ok: false as const, error: "Forbidden" };
			const { action, payload } = data;
			
			if (action === "upsert") {
				const item = payload as Fakultas;
				await prisma.fakultas.upsert({ where: { id: item.id }, update: item, create: item });
			} else if (action === "remove") {
				const id = String((payload as { id?: string }).id ?? "");
				await prisma.fakultas.delete({ where: { id } }).catch(() => {});
			}
			audit(caller, "fakultas", action, payload);
			return { ok: true as const };
		} catch (e: any) {
			return { ok: false as const, error: e.message };
		}
	});

export const mutateJurusanServer = createServerFn({ method: "POST" })
	.validator(z.object({ action: z.enum(["upsert", "remove"]), payload: z.any() }))
	.handler(async ({ data }) => {
		try {
			const caller = await requireSuperAdmin();
			if (!caller) return { ok: false as const, error: "Forbidden" };
			const { action, payload } = data;
			
			if (action === "upsert") {
				const item = payload as Jurusan;
				await prisma.jurusan.upsert({ where: { id: item.id }, update: item, create: item });
			} else if (action === "remove") {
				const id = String((payload as { id?: string }).id ?? "");
				await prisma.jurusan.delete({ where: { id } }).catch(() => {});
			}
			audit(caller, "jurusan", action, payload);
			return { ok: true as const };
		} catch (e: any) {
			return { ok: false as const, error: e.message };
		}
	});

export const mutateProdiServer = createServerFn({ method: "POST" })
	.validator(z.object({ action: z.enum(["upsert", "remove"]), payload: z.any() }))
	.handler(async ({ data }) => {
		try {
			const caller = await requireSuperAdmin();
			if (!caller) return { ok: false as const, error: "Forbidden" };
			const { action, payload } = data;
			
			if (action === "upsert") {
				const item = payload as ProgramStudi;
				await prisma.programStudi.upsert({ where: { id: item.id }, update: item, create: item });
			} else if (action === "remove") {
				const id = String((payload as { id?: string }).id ?? "");
				await prisma.programStudi.delete({ where: { id } }).catch(() => {});
			}
			audit(caller, "prodi", action, payload);
			return { ok: true as const };
		} catch (e: any) {
			return { ok: false as const, error: e.message };
		}
	});

export const mutateTahunAkademikServer = createServerFn({ method: "POST" })
	.validator(z.object({ action: z.enum(["upsert", "remove"]), payload: z.any() }))
	.handler(async ({ data }) => {
		try {
			const caller = await requireSuperAdmin();
			if (!caller) return { ok: false as const, error: "Forbidden" };
			const { action, payload } = data;
			
			if (action === "upsert") {
				const item = payload as TahunAkademik;
				await prisma.tahunAkademik.upsert({ where: { id: item.id }, update: item, create: item });
			} else if (action === "remove") {
				const id = String((payload as { id?: string }).id ?? "");
				await prisma.tahunAkademik.delete({ where: { id } }).catch(() => {});
			}
			audit(caller, "tahunAkademik", action, payload);
			return { ok: true as const };
		} catch (e: any) {
			return { ok: false as const, error: e.message };
		}
	});

export const mutateSemesterServer = createServerFn({ method: "POST" })
	.validator(z.object({ action: z.enum(["upsert", "remove"]), payload: z.any() }))
	.handler(async ({ data }) => {
		try {
			const caller = await requireSuperAdmin();
			if (!caller) return { ok: false as const, error: "Forbidden" };
			const { action, payload } = data;
			
			if (action === "upsert") {
				const item = payload as Semester;
				await prisma.semester.upsert({ where: { id: item.id }, update: item, create: item });
			} else if (action === "remove") {
				const id = String((payload as { id?: string }).id ?? "");
				await prisma.semester.delete({ where: { id } }).catch(() => {});
			}
			audit(caller, "semester", action, payload);
			return { ok: true as const };
		} catch (e: any) {
			return { ok: false as const, error: e.message };
		}
	});

export const mutateMataKuliahServer = createServerFn({ method: "POST" })
	.validator(z.object({ action: z.enum(["upsert", "remove"]), payload: z.any() }))
	.handler(async ({ data }) => {
		try {
			const caller = await requireSuperAdmin();
			if (!caller) return { ok: false as const, error: "Forbidden" };
			const { action, payload } = data;
			
			if (action === "upsert") {
				const item = payload as MataKuliah;
				await prisma.mataKuliah.upsert({ where: { id: item.id }, update: item, create: item });
			} else if (action === "remove") {
				const id = String((payload as { id?: string }).id ?? "");
				await prisma.mataKuliah.delete({ where: { id } }).catch(() => {});
			}
			audit(caller, "mataKuliah", action, payload);
			return { ok: true as const };
		} catch (e: any) {
			return { ok: false as const, error: e.message };
		}
	});
