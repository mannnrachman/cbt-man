import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { requireCaller, seedIfNeeded } from "../db/auth";
import { writeAuditLog } from "../db/audit";
import type { Fakultas, ProgramStudi, Rombel, TahunAkademik, Semester, MataKuliah } from "@/lib/cbt/types";
import {
	FakultasSchema,
	ProgramStudiSchema,
	RombelSchema,
	TahunAkademikSchema,
	SemesterSchema,
	MataKuliahSchema,
} from "@/lib/cbt/types";

function audit(caller: { id: string; role: string } | null, entity: string, action: string, payload: unknown) {
	if (caller) {
		const entityId =
			typeof payload === "object" && payload && "id" in payload
				? String((payload as { id?: unknown }).id ?? "")
				: undefined;
		writeAuditLog({
			userId: caller.id,
			userRole: caller.role,
			action: `${entity}.${action}`,
			entity,
			entityId,
			details: JSON.stringify({
				entity,
				action,
				entityId,
			}),
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

// ---------------- 1. FAKULTAS ----------------
const MutateFakultasSchema = z.discriminatedUnion("action", [
	z.object({
		action: z.literal("upsert"),
		payload: FakultasSchema,
	}),
	z.object({
		action: z.literal("remove"),
		payload: z.object({ id: z.string().min(1) }),
	}),
]);

export const mutateFakultasServer = createServerFn({ method: "POST" })
	.validator((d: unknown) => MutateFakultasSchema.parse(d))
	.handler(async ({ data }) => {
		const caller = await requireSuperAdmin();
		if (!caller) return { ok: false as const, error: "Akses ditolak: Hanya Super Admin yang diizinkan." };
		const { action, payload } = data;
		try {
			if (action === "upsert") {
				const item = payload;
				await prisma.fakultas.upsert({
					where: { id: item.id },
					update: { nama: item.nama },
					create: { id: item.id, nama: item.nama },
				});
			} else if (action === "remove") {
				const { id } = payload;
				const childCount = await prisma.programStudi.count({ where: { fakultasId: id } });
				if (childCount > 0) {
					return {
						ok: false as const,
						error: `Fakultas tidak dapat dihapus karena masih digunakan oleh ${childCount} Program Studi.`,
					};
				}
				await prisma.fakultas.delete({ where: { id } });
			}
			audit(caller, "fakultas", action, payload);
			return { ok: true as const };
		} catch (e) {
			console.error("[mutateFakultasServer] Error:", e);
			return { ok: false as const, error: "Gagal memproses data Fakultas. Pastikan data valid." };
		}
	});

// ---------------- 2. PROGRAM STUDI ----------------
const MutateProgramStudiSchema = z.discriminatedUnion("action", [
	z.object({
		action: z.literal("upsert"),
		payload: ProgramStudiSchema,
	}),
	z.object({
		action: z.literal("remove"),
		payload: z.object({ id: z.string().min(1) }),
	}),
]);

export const mutateProgramStudiServer = createServerFn({ method: "POST" })
	.validator((d: unknown) => MutateProgramStudiSchema.parse(d))
	.handler(async ({ data }) => {
		const caller = await requireSuperAdmin();
		if (!caller) return { ok: false as const, error: "Akses ditolak: Hanya Super Admin yang diizinkan." };
		const { action, payload } = data;
		try {
			if (action === "upsert") {
				const item = payload;
				const fakultas = await prisma.fakultas.findUnique({ where: { id: item.fakultasId } });
				if (!fakultas) {
					return { ok: false as const, error: "Fakultas yang dipilih tidak ditemukan." };
				}
				await prisma.programStudi.upsert({
					where: { id: item.id },
					update: { nama: item.nama, fakultasId: item.fakultasId },
					create: { id: item.id, nama: item.nama, fakultasId: item.fakultasId },
				});
			} else if (action === "remove") {
				const { id } = payload;
				const rombelCount = await prisma.rombel.count({ where: { programStudiId: id } });
				const matkulCount = await prisma.mataKuliah.count({ where: { programStudiId: id } });
				if (rombelCount > 0 || matkulCount > 0) {
					return {
						ok: false as const,
						error: `Program Studi tidak dapat dihapus karena masih digunakan oleh ${rombelCount} Kelas dan ${matkulCount} Mata Kuliah.`,
					};
				}
				await prisma.programStudi.delete({ where: { id } });
			}
			audit(caller, "programStudi", action, payload);
			return { ok: true as const };
		} catch (e) {
			console.error("[mutateProgramStudiServer] Error:", e);
			return { ok: false as const, error: "Gagal memproses data Program Studi. Pastikan data valid." };
		}
	});

// ---------------- 3. ROMBEL / KELAS ----------------
const InputRombelSchema = z.object({
	id: z.string().min(1),
	nama: z.string().trim().min(1),
	programStudiId: z.string().min(1),
	tahunAkademikId: z.string().optional(),
});

const MutateRombelSchema = z.discriminatedUnion("action", [
	z.object({
		action: z.literal("upsert"),
		payload: InputRombelSchema,
	}),
	z.object({
		action: z.literal("remove"),
		payload: z.object({ id: z.string().min(1) }),
	}),
]);

export const mutateRombelServer = createServerFn({ method: "POST" })
	.validator((d: unknown) => MutateRombelSchema.parse(d))
	.handler(async ({ data }) => {
		const caller = await requireSuperAdmin();
		if (!caller) return { ok: false as const, error: "Akses ditolak: Hanya Super Admin yang diizinkan." };
		const { action, payload } = data;
		try {
			if (action === "upsert") {
				const item = payload;
				const prodi = await prisma.programStudi.findUnique({ where: { id: item.programStudiId } });
				if (!prodi) {
					return { ok: false as const, error: "Program Studi yang dipilih tidak ditemukan." };
				}

				let taId = item.tahunAkademikId;
				if (!taId) {
					const activeTa =
						(await prisma.tahunAkademik.findFirst({ where: { aktif: true } })) ||
						(await prisma.tahunAkademik.findFirst());
					if (!activeTa) {
						return {
							ok: false as const,
							error: "Belum ada Tahun Akademik. Silakan buat Tahun Akademik terlebih dahulu.",
						};
					}
					taId = activeTa.id;
				} else {
					const ta = await prisma.tahunAkademik.findUnique({ where: { id: taId } });
					if (!ta) {
						return { ok: false as const, error: "Tahun Akademik yang dipilih tidak ditemukan." };
					}
				}

				await prisma.rombel.upsert({
					where: { id: item.id },
					update: { nama: item.nama, programStudiId: item.programStudiId, tahunAkademikId: taId },
					create: { id: item.id, nama: item.nama, programStudiId: item.programStudiId, tahunAkademikId: taId },
				});
			} else if (action === "remove") {
				const { id } = payload;
				const userCount = await prisma.user.count({ where: { rombelId: id } });
				if (userCount > 0) {
					return {
						ok: false as const,
						error: `Kelas tidak dapat dihapus karena masih digunakan oleh ${userCount} Peserta.`,
					};
				}
				await prisma.rombel.delete({ where: { id } });
			}
			audit(caller, "rombel", action, payload);
			return { ok: true as const };
		} catch (e) {
			console.error("[mutateRombelServer] Error:", e);
			return { ok: false as const, error: "Gagal memproses data Kelas. Pastikan data valid." };
		}
	});

// ---------------- 4. TAHUN AKADEMIK ----------------
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
				const item = payload;
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
				const { id } = payload;
				const rombelCount = await prisma.rombel.count({ where: { tahunAkademikId: id } });
				const semesterCount = await prisma.semester.count({ where: { tahunAkademikId: id } });
				if (rombelCount > 0 || semesterCount > 0) {
					return {
						ok: false as const,
						error: `Tahun Akademik tidak dapat dihapus karena masih digunakan oleh ${rombelCount} Kelas dan ${semesterCount} Semester.`,
					};
				}
				await prisma.tahunAkademik.delete({ where: { id } });
			}
			audit(caller, "tahunAkademik", action, payload);
			return { ok: true as const };
		} catch (e) {
			console.error("[mutateTahunAkademikServer] Error:", e);
			return { ok: false as const, error: "Gagal memproses data Tahun Akademik." };
		}
	});

// ---------------- 5. SEMESTER ----------------
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
				const item = payload;
				const ta = await prisma.tahunAkademik.findUnique({ where: { id: item.tahunAkademikId } });
				if (!ta) {
					return { ok: false as const, error: "Tahun Akademik yang dipilih tidak ditemukan." };
				}
				await prisma.semester.upsert({
					where: { id: item.id },
					update: { nama: item.nama, tahunAkademikId: item.tahunAkademikId },
					create: { id: item.id, nama: item.nama, tahunAkademikId: item.tahunAkademikId },
				});
			} else if (action === "remove") {
				const { id } = payload;
				const matkulCount = await prisma.mataKuliah.count({ where: { semesterId: id } });
				if (matkulCount > 0) {
					return {
						ok: false as const,
						error: `Semester tidak dapat dihapus karena masih digunakan oleh ${matkulCount} Mata Kuliah.`,
					};
				}
				await prisma.semester.delete({ where: { id } });
			}
			audit(caller, "semester", action, payload);
			return { ok: true as const };
		} catch (e) {
			console.error("[mutateSemesterServer] Error:", e);
			return { ok: false as const, error: "Gagal memproses data Semester." };
		}
	});

// ---------------- 6. MATA KULIAH ----------------
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
				const item = payload;
				await prisma.mataKuliah.upsert({
					where: { id: item.id },
					update: {
						kode: item.kode,
						nama: item.nama,
						sks: item.sks,
						programStudiId: item.programStudiId || null,
						semesterId: item.semesterId || null,
					},
					create: {
						id: item.id,
						kode: item.kode,
						nama: item.nama,
						sks: item.sks,
						programStudiId: item.programStudiId || null,
						semesterId: item.semesterId || null,
					},
				});
			} else if (action === "remove") {
				const { id } = payload;
				const userMatkulCount = await prisma.userMataKuliah.count({ where: { mataKuliahId: id } });
				if (userMatkulCount > 0) {
					return {
						ok: false as const,
						error: `Mata Kuliah tidak dapat dihapus karena masih digunakan oleh ${userMatkulCount} Pengampu/Dosen.`,
					};
				}
				await prisma.mataKuliah.delete({ where: { id } });
			}
			audit(caller, "mataKuliah", action, payload);
			return { ok: true as const };
		} catch (e) {
			console.error("[mutateMataKuliahServer] Error:", e);
			return { ok: false as const, error: "Gagal memproses data Mata Kuliah." };
		}
	});

// ---------------- 7. READ ACCESS LISTS ----------------
export const getFakultasList = createServerFn({ method: "GET" }).handler(
	async (): Promise<Fakultas[]> => {
		const caller = await requireCaller();
		if (!caller || caller.role === "mahasiswa") return [];
		const records = await prisma.fakultas.findMany({ orderBy: { nama: "asc" } });
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
		if (!caller || caller.role === "mahasiswa") return [];
		const records = await prisma.programStudi.findMany({ orderBy: { nama: "asc" } });
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
		if (!caller || caller.role === "mahasiswa") return [];
		const records = await prisma.rombel.findMany({ orderBy: { nama: "asc" } });
		const results: Rombel[] = [];
		for (const rec of records) {
			const parsed = RombelSchema.safeParse(rec);
			if (parsed.success) results.push(parsed.data);
		}
		return results;
	}
);
