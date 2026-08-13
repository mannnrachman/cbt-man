/* eslint-disable @typescript-eslint/no-explicit-any */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { requireCaller, seedIfNeeded } from "../db/auth";
import { writeAuditLog } from "../db/audit";
import type { Fakultas, ProgramStudi, Rombel, TahunAkademik, Semester, MataKuliah } from "@/lib/cbt/types";
import { FakultasSchema, ProgramStudiSchema, RombelSchema } from "@/lib/cbt/types";


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
		const caller = await requireSuperAdmin();
		if (!caller) return { ok: false as const, error: "Unauthorized" };
		const { action, payload } = data;
		try {
			if (action === "upsert") {
				const item = payload as Fakultas;
				await prisma.fakultas.upsert({ where: { id: item.id }, update: item, create: item });
			} else if (action === "remove") {
				const id = (payload as { id: string }).id;
				await prisma.fakultas.delete({ where: { id } });
			}
			audit(caller, "fakultas", action, payload);

			return { ok: true as const };
		} catch (e: any) {
			return { ok: false as const, error: e.message };
		}
	});

export const mutateProgramStudiServer = createServerFn({ method: "POST" })
	.validator(z.object({ action: z.enum(["upsert", "remove"]), payload: z.any() }))
	.handler(async ({ data }) => {
		const caller = await requireSuperAdmin();
		if (!caller) return { ok: false as const, error: "Unauthorized" };
		const { action, payload } = data;
		try {
			if (action === "upsert") {
				const item = payload as ProgramStudi;
				await prisma.programStudi.upsert({ where: { id: item.id }, update: item, create: item });
			} else if (action === "remove") {
				const id = (payload as { id: string }).id;
				await prisma.programStudi.delete({ where: { id } });
			}
			audit(caller, "programStudi", action, payload);

			return { ok: true as const };
		} catch (e: any) {
			return { ok: false as const, error: e.message };
		}
	});

export const mutateRombelServer = createServerFn({ method: "POST" })
	.validator(z.object({ action: z.enum(["upsert", "remove"]), payload: z.any() }))
	.handler(async ({ data }) => {
		const caller = await requireSuperAdmin();
		if (!caller) return { ok: false as const, error: "Unauthorized" };
		const { action, payload } = data;
		try {
			if (action === "upsert") {
				const item = payload as Rombel;
				await prisma.rombel.upsert({ where: { id: item.id }, update: item, create: item });
			} else if (action === "remove") {
				const id = (payload as { id: string }).id;
				await prisma.rombel.delete({ where: { id } });
			}
			audit(caller, "rombel", action, payload);

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
					await prisma.$transaction([
						prisma.tahunAkademik.updateMany({
							where: { id: { not: item.id } },
							data: { aktif: false },
						}),
						prisma.tahunAkademik.upsert({ where: { id: item.id }, update: item, create: item }),
					]);
				} else {
					await prisma.tahunAkademik.upsert({ where: { id: item.id }, update: item, create: item });
				}
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
export const getFakultasList = createServerFn({ method: "GET" }).handler(
	async (): Promise<Fakultas[]> => {
		const caller = await requireCaller();
		if (!caller || caller.role !== "super_admin") return [];
		const records = await prisma.fakultas.findMany();
		const results: Fakultas[] = [];
		for (const rec of records) {
			const parsed = FakultasSchema.safeParse(rec);
			if (parsed.success) results.push(parsed.data);
		}
		return results;
	}
);

export const getProgramStudiList = createServerFn({ method: "GET" }).handler(
	async (): Promise<ProgramStudi[]> => {
		const caller = await requireCaller();
		if (!caller || caller.role !== "super_admin") return [];
		const records = await prisma.programStudi.findMany();
		const results: ProgramStudi[] = [];
		for (const rec of records) {
			const parsed = ProgramStudiSchema.safeParse(rec);
			if (parsed.success) results.push(parsed.data);
		}
		return results;
	}
);

export const getRombelList = createServerFn({ method: "GET" }).handler(
	async (): Promise<Rombel[]> => {
		const caller = await requireCaller();
		if (!caller || caller.role !== "super_admin") return [];
		const records = await prisma.rombel.findMany();
		const results: Rombel[] = [];
		for (const rec of records) {
			const parsed = RombelSchema.safeParse(rec);
			if (parsed.success) results.push(parsed.data);
		}
		return results;
	}
);
