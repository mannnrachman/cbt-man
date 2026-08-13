import { z } from "zod";
import type { AppConfig, Modul, NavKey, Soal, SesiUjian, TokenUjian, Topik, Ujian, User, TahunAkademik, Semester, MataKuliah, Fakultas, ProgramStudi, Rombel } from "@/lib/cbt/types";
import { prisma } from "@/lib/server/db/prisma";
import { parseJson, toNumber } from "@/lib/server/db/json";

export type Snapshot = {
	users: User[];
	fakultas: Fakultas[];
	programStudi: ProgramStudi[];
	rombel: Rombel[];
	tahunAkademik: TahunAkademik[];
	semester: Semester[];
	mataKuliah: MataKuliah[];
	modul: Modul[];
	topik: Topik[];
	soal: Soal[];
	ujian: Ujian[];
	token: TokenUjian[];
	sesi: SesiUjian[];
	config: AppConfig;
};

export type PublicBootConfig = Pick<
	AppConfig,
	"appName" | "appLogo" | "appDeskripsi" | "pesanLogin"
>;

export type UserRow = Awaited<ReturnType<typeof prisma.user.findMany>>[number] & { mataKuliah?: { mataKuliahId: string }[] };
export type SoalRow = Awaited<ReturnType<typeof prisma.soal.findMany>>[number] & {
	jawaban: { id: string; detail: string; benar: boolean }[];
};
export type SnapshotRows = {
	users: UserRow[];
	fakultas: Awaited<ReturnType<typeof prisma.fakultas.findMany>>;
	programStudi: Awaited<ReturnType<typeof prisma.programStudi.findMany>>;
	rombel: Awaited<ReturnType<typeof prisma.rombel.findMany>>;
	tahunAkademik: TahunAkademik[];
	semester: Semester[];
	mataKuliah: MataKuliah[];
	modul: (Awaited<ReturnType<typeof prisma.modul.findMany>>[number] & { mataKuliah?: { mataKuliahId: string }[] })[];
	topik: Topik[];
	soal: SoalRow[];
	ujian: Awaited<ReturnType<typeof prisma.ujian.findMany>>;
	token: Awaited<ReturnType<typeof prisma.tokenUjian.findMany>>;
	sesi: Awaited<ReturnType<typeof prisma.sesiUjian.findMany>>;
	config: Awaited<ReturnType<typeof prisma.appConfig.findUnique>>;
};

export const roleSchema = z.enum(["super_admin", "admin_prodi", "evaluator", "mahasiswa"]);
export const entitySchema = z.enum([
	"users",
	"fakultas",
	"programStudi",
	"rombel",
	"tahunAkademik",
	"semester",
	"mataKuliah",
	"modul",
	"topik",
	"soal",
	"ujian",
	"token",
	"sesi",
]);
export const upsertUserSchema = z.object({
	id: z.string().min(1),
	username: z.string().min(3),
	namaLengkap: z.string().min(1),
	role: roleSchema,
	allowedTopikIds: z.array(z.string()).default([]),
	rombelId: z.string().min(1).optional(),
	mataKuliahIds: z.array(z.string()).default([]),
	detail: z.string().optional(),
	aktif: z.boolean(),
	createdAt: z.number().optional(),
	newPassword: z.string().min(1).optional(),
});

export const DEFAULT_OPERATOR_ROLE_ACCESS = [
	"dashboard",
	"peserta",
	"modul",
	"files",
	"ujian",
	"hasil",
	"evaluasi",
	"laporan",
	"leaderboard",
] as const;

export const DEFAULT_EVALUATOR_ROLE_ACCESS = [
	"dashboard",
	"hasil",
	"evaluasi",
	"laporan",
	"leaderboard",
] as const;

export function mapToSnapshot(raw: SnapshotRows): Snapshot {
	return {
		users: raw.users.map((u) => ({
			id: u.id,
			username: u.username,
			passwordHash: u.passwordHash,
			namaLengkap: u.namaLengkap,
			role: roleSchema.parse(u.role),
			allowedTopikIds: parseJson<string[]>(u.allowedTopikIds, []),
			rombelId: u.rombelId ?? undefined,
			mataKuliahIds: u.mataKuliah?.map(m => m.mataKuliahId) ?? [],
			detail: u.detail ?? undefined,
			aktif: u.aktif,
			createdAt: Number(u.createdAt),
		})),
		fakultas: raw.fakultas,
		programStudi: raw.programStudi,
		rombel: raw.rombel,
		tahunAkademik: raw.tahunAkademik,
		semester: raw.semester,
		mataKuliah: raw.mataKuliah.map(m => ({
			id: m.id,
			kode: m.kode,
			nama: m.nama,
			sks: m.sks,
			programStudiId: m.programStudiId ?? undefined,
			semesterId: m.semesterId ?? undefined,
		})),
		modul: raw.modul.map(m => ({
			id: m.id,
			nama: m.nama,
			aktif: m.aktif,
			mataKuliahIds: m.mataKuliah?.map(mk => mk.mataKuliahId) ?? [],
		})),
		topik: raw.topik,
		soal: raw.soal.map(mapSoal),
		ujian: raw.ujian.map(mapUjian),
		token: raw.token.map(mapToken),
		sesi: raw.sesi.map(mapSesi),
		config: buildConfig(raw.config),
	};
}

export function mapUser(row: UserRow): User {
	return {
		id: row.id,
		username: row.username,
		passwordHash: row.passwordHash,
		namaLengkap: row.namaLengkap,
		role: row.role,
		allowedTopikIds: parseJson(row.allowedTopikIds, []),
		rombelId: row.rombelId ?? undefined,
		mataKuliahIds: row.mataKuliah?.map(m => m.mataKuliahId) ?? [],
		detail: row.detail ?? undefined,
		aktif: row.aktif,
		createdAt: Number(row.createdAt),
	};
}

export function publicUser(row: UserRow): User {
	return { ...mapUser(row), passwordHash: "" };
}

export function mapSoal(row: SoalRow): Soal {
	return {
		id: row.id,
		topikId: row.topikId,
		detail: row.detail,
		tipe: row.tipe,
		kesulitan: row.kesulitan,
		audioFileId: row.audioFileId ?? undefined,
		audioPlayOnce: row.audioPlayOnce,
		jawaban: row.jawaban.map((item) => ({
			id: item.id,
			detail: item.detail,
			benar: item.benar,
		})),
		pembahasan: row.pembahasan,
		createdAt: Number(row.createdAt),
	};
}

export function mapUjian(
	row: Awaited<ReturnType<typeof prisma.ujian.findMany>>[number],
): Ujian {
	return {
		id: row.id,
		nama: row.nama,
		deskripsi: row.deskripsi,
		durasiMenit: row.durasiMenit,
		poinBenar: row.poinBenar,
		poinSalah: row.poinSalah,
		poinKosong: row.poinKosong,
		beginAt: toNumber(row.beginAt),
		endAt: toNumber(row.endAt),
		tokenAktif: row.tokenAktif,
		ipRange: row.ipRange,
		groupIds: parseJson(row.groupIds, []),
		mataKuliahId: row.mataKuliahId ?? undefined,
		semesterId: row.semesterId ?? undefined,
		topicSets: parseJson(row.topicSets, []),
		showResult: row.showResult,
		showResultDetail: row.showResultDetail,
		fullscreenWajib: row.fullscreenWajib,
		maxPindahTab: row.maxPindahTab,
		blokirShortcut: row.blokirShortcut,
		mode: (row.mode ?? "online") as "online" | "offline",
		allowCalculator: row.allowCalculator,
		allowNilaiNormal: row.allowNilaiNormal,
		createdBy: row.createdBy,
		createdAt: Number(row.createdAt),
	};
}

export function mapToken(
	row: Awaited<ReturnType<typeof prisma.tokenUjian.findMany>>[number],
): TokenUjian {
	return {
		id: row.id,
		ujianId: row.ujianId,
		kode: row.kode,
		expireAt: toNumber(row.expireAt),
	};
}

export function mapSesi(
	row: Awaited<ReturnType<typeof prisma.sesiUjian.findMany>>[number],
): SesiUjian {
	return {
		id: row.id,
		ujianId: row.ujianId,
		pesertaId: row.pesertaId,
		status: row.status,
		mulaiAt: toNumber(row.mulaiAt),
		selesaiAt: toNumber(row.selesaiAt),
		endsAt: toNumber(row.endsAt),
		soalIds: parseJson(row.soalIds, []),
		jawabanOrder: parseJson(row.jawabanOrder, {}),
		jawaban: parseJson(row.jawaban, []),
		pelanggaran: row.pelanggaran,
		skorTotal: row.skorTotal ?? undefined,
		maxSkor: row.maxSkor ?? undefined,
		gradedAt: toNumber(row.gradedAt),
		gradedBy: row.gradedBy ?? undefined,
		createdAt: Number(row.createdAt),
	};
}

export function buildConfig(config: SnapshotRows["config"]): AppConfig {
	return {
		appName: config?.appName ?? "CBT-MAN",
		appLogo: config?.appLogo ?? "",
		appDeskripsi: config?.appDeskripsi ?? "Aplikasi ujian berbasis komputer",
		pesanLogin: config?.pesanLogin ?? "Selamat datang di aplikasi ujian online",
		mobileLock: config?.mobileLock ?? false,
		multiDevice: config?.multiDevice ?? false,
		roleAccess: parseJson(config?.roleAccess, {
			admin_prodi: [...DEFAULT_OPERATOR_ROLE_ACCESS],
			evaluator: [...DEFAULT_EVALUATOR_ROLE_ACCESS],
		}),
	};
}

export function buildPublicBootConfig(
	config: SnapshotRows["config"],
): PublicBootConfig {
	const full = buildConfig(config);
	return {
		appName: full.appName,
		appLogo: full.appLogo,
		appDeskripsi: full.appDeskripsi,
		pesanLogin: full.pesanLogin,
	};
}
