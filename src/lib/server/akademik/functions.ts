/* eslint-disable @typescript-eslint/no-explicit-any */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { requireCaller, seedIfNeeded } from "../db/auth";
import { writeAuditLog } from "../db/audit";
import type { UnitAkademik, TahunAkademik, Semester, MataKuliah } from "@/lib/cbt/types";
import { mapPenawaran } from "../repos/mappers";
import { compareAndSetMembership } from "@/lib/cbt/penawaran-membership";
import {
	UnitAkademikSchema,
	TahunAkademikSchema,
	SemesterSchema,
	MataKuliahSchema,
} from "@/lib/cbt/types";

function audit(caller: any, entity: string, action: string, payload: any) {
	if (caller) {
		writeAuditLog({
			userId: caller.id,
			userRole: caller.role,
			action: `${entity}.${action}`,
			entity,
			entityId:
				typeof payload === "object" && payload && "id" in payload
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

// ---------------- 1. UNIT AKADEMIK ----------------
const MutateUnitAkademikSchema = z.discriminatedUnion("action", [
	z.object({
		action: z.literal("upsert"),
		payload: UnitAkademikSchema,
	}),
	z.object({
		action: z.literal("remove"),
		payload: z.object({ id: z.string().min(1) }),
	}),
]);

export const mutateUnitAkademikServer = createServerFn({ method: "POST" })
	.validator((d: unknown) => MutateUnitAkademikSchema.parse(d))
	.handler(async ({ data }) => {
		const caller = await requireSuperAdmin();
		if (!caller) return { ok: false as const, error: "Akses ditolak: Hanya Super Admin yang diizinkan." };
		const { action, payload } = data;
		try {
			if (action === "upsert") {
				const item = payload as UnitAkademik;
				await prisma.unitAkademik.upsert({
					where: { id: item.id },
					update: {
						nama: item.nama,
						tipe: item.tipe,
						parentId: item.parentId ?? null,
					},
					create: {
						id: item.id,
						nama: item.nama,
						tipe: item.tipe,
						parentId: item.parentId ?? null,
					},
				});
			} else if (action === "remove") {
				const id = payload.id;
				// Relational Integrity Checks
				const childCount = await prisma.unitAkademik.count({ where: { parentId: id } });
				if (childCount > 0) {
					return {
						ok: false as const,
						error: `Unit akademik tidak dapat dihapus karena masih memiliki ${childCount} sub-unit di bawahnya.`,
					};
				}

				const userCount = await prisma.user.count({ where: { unitId: id } });
				if (userCount > 0) {
					return {
						ok: false as const,
						error: `Unit akademik tidak dapat dihapus karena masih digunakan oleh ${userCount} Pengguna/Peserta.`,
					};
				}

				const matkulCount = await prisma.mataKuliah.count({ where: { unitId: id } });
				if (matkulCount > 0) {
					return {
						ok: false as const,
						error: `Unit akademik tidak dapat dihapus karena masih digunakan oleh ${matkulCount} Mata Kuliah.`,
					};
				}

				await prisma.unitAkademik.delete({ where: { id } });
			}
			audit(caller, "unitAkademik", action, payload);

			return { ok: true as const };
		} catch (e: any) {
			console.error("[mutateUnitAkademikServer] Error:", e);
			return { ok: false as const, error: "Gagal memproses data Unit Akademik. Pastikan data valid." };
		}
	});

// ---------------- 2. TAHUN AKADEMIK ----------------
const MutateTahunAkademikSchema = z.discriminatedUnion("action", [
	z.object({
		action: z.literal("upsert"),
		payload: TahunAkademikSchema,
	}),
	z.object({
		action: z.literal("remove"),
		payload: z.object({ id: z.string().min(1) }),
	}),
]);

export const mutateTahunAkademikServer = createServerFn({ method: "POST" })
	.validator((d: unknown) => MutateTahunAkademikSchema.parse(d))
	.handler(async ({ data }) => {
		try {
			const caller = await requireSuperAdmin();
			if (!caller) return { ok: false as const, error: "Akses ditolak: Hanya Super Admin yang diizinkan." };
			const { action, payload } = data;

			if (action === "upsert") {
				const item = payload as TahunAkademik;
				if (item.aktif) {
					await prisma.$transaction([
						prisma.tahunAkademik.updateMany({
							where: { id: { not: item.id } },
							data: { aktif: false },
						}),
						prisma.tahunAkademik.upsert({
							where: { id: item.id },
							update: { nama: item.nama, aktif: item.aktif },
							create: { id: item.id, nama: item.nama, aktif: item.aktif },
						}),
					]);
				} else {
					await prisma.tahunAkademik.upsert({
						where: { id: item.id },
						update: { nama: item.nama, aktif: item.aktif },
						create: { id: item.id, nama: item.nama, aktif: item.aktif },
					});
				}
			} else if (action === "remove") {
				const id = payload.id;
				const semCount = await prisma.semester.count({ where: { tahunAkademikId: id } });
				if (semCount > 0) {
					return {
						ok: false as const,
						error: `Tahun Akademik tidak dapat dihapus karena masih memiliki ${semCount} Semester di bawahnya.`,
					};
				}
				await prisma.tahunAkademik.delete({ where: { id } }).catch(() => {});
			}
			audit(caller, "tahunAkademik", action, payload);
			return { ok: true as const };
		} catch (e: any) {
			console.error("[mutateTahunAkademikServer] Error:", e);
			return { ok: false as const, error: "Gagal memproses data Tahun Akademik." };
		}
	});

// ---------------- 3. SEMESTER ----------------
const MutateSemesterSchema = z.discriminatedUnion("action", [
	z.object({
		action: z.literal("upsert"),
		payload: SemesterSchema,
	}),
	z.object({
		action: z.literal("remove"),
		payload: z.object({ id: z.string().min(1) }),
	}),
]);

export const mutateSemesterServer = createServerFn({ method: "POST" })
	.validator((d: unknown) => MutateSemesterSchema.parse(d))
	.handler(async ({ data }) => {
		try {
			const caller = await requireSuperAdmin();
			if (!caller) return { ok: false as const, error: "Akses ditolak: Hanya Super Admin yang diizinkan." };
			const { action, payload } = data;

			if (action === "upsert") {
				const item = payload as Semester;
				await prisma.semester.upsert({
					where: { id: item.id },
					update: { nama: item.nama, tahunAkademikId: item.tahunAkademikId },
					create: { id: item.id, nama: item.nama, tahunAkademikId: item.tahunAkademikId },
				});
			} else if (action === "remove") {
				const id = payload.id;
				const ujianCount = await prisma.ujian.count({ where: { semesterId: id } });
				const matkulCount = await prisma.mataKuliah.count({ where: { semesterId: id } });
				if (ujianCount > 0 || matkulCount > 0) {
					return {
						ok: false as const,
						error: `Semester tidak dapat dihapus karena masih digunakan oleh ${ujianCount} Paket Ujian dan ${matkulCount} Mata Kuliah.`,
					};
				}
				await prisma.semester.delete({ where: { id } }).catch(() => {});
			}
			audit(caller, "semester", action, payload);
			return { ok: true as const };
		} catch (e: any) {
			console.error("[mutateSemesterServer] Error:", e);
			return { ok: false as const, error: "Gagal memproses data Semester." };
		}
	});

// ---------------- 4. MATA KULIAH ----------------
const MutateMataKuliahSchema = z.discriminatedUnion("action", [
	z.object({
		action: z.literal("upsert"),
		payload: MataKuliahSchema,
	}),
	z.object({
		action: z.literal("remove"),
		payload: z.object({ id: z.string().min(1) }),
	}),
]);

export const mutateMataKuliahServer = createServerFn({ method: "POST" })
	.validator((d: unknown) => MutateMataKuliahSchema.parse(d))
	.handler(async ({ data }) => {
		try {
			const caller = await requireSuperAdmin();
			if (!caller) return { ok: false as const, error: "Akses ditolak: Hanya Super Admin yang diizinkan." };
			const { action, payload } = data;

			if (action === "upsert") {
				const item = payload as MataKuliah;
				await prisma.mataKuliah.upsert({
					where: { id: item.id },
					update: {
						kode: item.kode,
						nama: item.nama,
						sks: item.sks,
						unitId: item.unitId ?? null,
						semesterId: item.semesterId ?? null,
					},
					create: {
						id: item.id,
						kode: item.kode,
						nama: item.nama,
						sks: item.sks,
						unitId: item.unitId ?? null,
						semesterId: item.semesterId ?? null,
					},
				});
			} else if (action === "remove") {
				const id = payload.id;
				const ujianCount = await prisma.ujian.count({ where: { mataKuliahId: id } });
				if (ujianCount > 0) {
					return {
						ok: false as const,
						error: `Mata Kuliah tidak dapat dihapus karena masih digunakan oleh ${ujianCount} Paket Ujian.`,
					};
				}
				await prisma.mataKuliah.delete({ where: { id } }).catch(() => {});
			}
			audit(caller, "mataKuliah", action, payload);
			return { ok: true as const };
		} catch (e: any) {
			console.error("[mutateMataKuliahServer] Error:", e);
			return { ok: false as const, error: "Gagal memproses data Mata Kuliah." };
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

export const mutatePenawaranMembershipServer = createServerFn({ method: "POST" })
	.validator(z.object({
		id: z.string().min(1),
		expectedPengampuIds: z.array(z.string()),
		expectedPesertaIds: z.array(z.string()),
		pengampuIds: z.array(z.string()),
		pesertaIds: z.array(z.string()),
	}))
	.handler(async ({ data }) => {
		const caller = await requireSuperAdmin();
		if (!caller) return { ok: false as const, error: "Akses ditolak: Hanya Super Admin yang diizinkan." };
		try {
			const row = await prisma.$transaction((tx) => compareAndSetMembership(
				async () => (await tx.penawaranMataKuliah.updateMany({
					where: {
						id: data.id,
						pengampuIds: JSON.stringify(data.expectedPengampuIds),
						pesertaIds: JSON.stringify(data.expectedPesertaIds),
					},
					data: {
						pengampuIds: JSON.stringify(data.pengampuIds),
						pesertaIds: JSON.stringify(data.pesertaIds),
					},
				})).count,
				() => tx.penawaranMataKuliah.findUnique({ where: { id: data.id } }),
			));
			if (!row) {
				return { ok: false as const, error: "Data anggota telah berubah. Muat ulang lalu coba lagi." };
			}
			audit(caller, "penawaran", "membership", data);
			return { ok: true as const, penawaran: mapPenawaran(row) };
		} catch {
			return { ok: false as const, error: "Gagal memperbarui anggota kelas mata kuliah." };
		}
	});
