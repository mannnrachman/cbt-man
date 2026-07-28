/* eslint-disable @typescript-eslint/no-explicit-any */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { requireCaller, seedIfNeeded } from "../db/auth";
import { writeAuditLog } from "../db/audit";
import type { UnitAkademik, TahunAkademik, Semester, MataKuliah } from "@/lib/cbt/types";
import { UnitAkademikSchema } from "@/lib/cbt/types";


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
				const childCount = await prisma.unitAkademik.count({ where: { parentId: id } });
				if (childCount > 0) {
					return { ok: false as const, error: `Tidak dapat menghapus: Unit ini masih memiliki ${childCount} sub-unit.` };
				}
				await prisma.unitAkademik.delete({ where: { id } });
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
				if (item.aktif) {
					await prisma.tahunAkademik.updateMany({
						where: { id: { not: item.id } },
						data: { aktif: false },
					});
				}
				await prisma.tahunAkademik.upsert({ where: { id: item.id }, update: item, create: item });
			} else if (action === "remove") {
				const id = String((payload as { id?: string }).id ?? "");
				const semCount = await prisma.semester.count({ where: { tahunAkademikId: id } });
				if (semCount > 0) {
					return { ok: false as const, error: `Tidak dapat menghapus: Masih ada ${semCount} semester terikat pada tahun akademik ini.` };
				}
				await prisma.tahunAkademik.delete({ where: { id } });
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
				const mkCount = await prisma.mataKuliah.count({ where: { semesterId: id } });
				if (mkCount > 0) {
					return { ok: false as const, error: `Tidak dapat menghapus: Masih ada ${mkCount} mata kuliah terikat pada semester ini.` };
				}
				await prisma.semester.delete({ where: { id } });
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
				const modulCount = await prisma.modul.count({ where: { mataKuliahId: id } });
				if (modulCount > 0) {
					return { ok: false as const, error: `Tidak dapat menghapus: Masih ada ${modulCount} modul/bank soal terikat pada mata kuliah ini.` };
				}
				await prisma.mataKuliah.delete({ where: { id } });
			}
			audit(caller, "mataKuliah", action, payload);
			return { ok: true as const };
		} catch (e: any) {
			return { ok: false as const, error: e.message };
		}
	});
export const getUnitAkademikList = createServerFn({ method: "GET" }).handler(
	async (): Promise<UnitAkademik[]> => {
		const caller = await requireCaller();
		if (!caller || caller.role !== "super_admin") return [];
		const records = await prisma.unitAkademik.findMany();
		const results: UnitAkademik[] = [];
		for (const rec of records) {
			const parsed = UnitAkademikSchema.safeParse(rec);
			if (parsed.success) results.push(parsed.data);
		}
		return results;
	}
);
