import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { requireCaller, seedIfNeeded } from "../db/auth";
import { writeAuditLog } from "../db/audit";
import type { UnitAkademik, TahunAkademik, Semester, MataKuliah } from "@/lib/cbt/types";

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

export const mutateUnitAkademikServer = createServerFn({ method: "POST" })
	.validator(z.object({ action: z.enum(["upsert", "remove"]), payload: z.any() }))
	.handler(async ({ data }) => {
		const caller = await requireSuperAdmin();
		if (!caller) return { ok: false as const, error: "Unauthorized" };
		const { action, payload } = data;
		try {
			if (action === "upsert") {
				const item = payload as UnitAkademik;
				await prisma.unitAkademik.upsert({ where: { id: item.id }, update: item, create: item });
			} else if (action === "remove") {
				const id = (payload as { id: string }).id;
				await prisma.unitAkademik.delete({ where: { id } }).catch(() => {});
			}
			audit(caller, "unitAkademik", action, payload);
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
