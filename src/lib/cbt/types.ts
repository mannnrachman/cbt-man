import { z } from "zod";

// ---------------- Enums ----------------
export const RoleEnum = z.enum(["super_admin", "admin_prodi", "evaluator", "mahasiswa"]);
export type Role = z.infer<typeof RoleEnum>;

export const TipeSoalEnum = z.enum(["pg", "multi", "bs", "essay"]);
export type TipeSoal = z.infer<typeof TipeSoalEnum>;

export const KesulitanEnum = z.enum(["mudah", "sedang", "sulit"]);
export type Kesulitan = z.infer<typeof KesulitanEnum>;

export const StatusSesiEnum = z.enum([
	"belum",
	"sedang",
	"selesai",
	"kedaluwarsa",
]);
export type StatusSesi = z.infer<typeof StatusSesiEnum>;

// ---------------- Master Akademik ----------------
export const FakultasSchema = z.object({
	id: z.string(),
	nama: z.string(),
});
export type Fakultas = z.infer<typeof FakultasSchema>;

export const JurusanSchema = z.object({
	id: z.string(),
	nama: z.string(),
	fakultasId: z.string(),
});
export type Jurusan = z.infer<typeof JurusanSchema>;

export const ProgramStudiSchema = z.object({
	id: z.string(),
	nama: z.string(),
	jurusanId: z.string(),
});
export type ProgramStudi = z.infer<typeof ProgramStudiSchema>;

export const TahunAkademikSchema = z.object({
	id: z.string(),
	nama: z.string(),
	aktif: z.boolean().default(false),
});
export type TahunAkademik = z.infer<typeof TahunAkademikSchema>;

export const SemesterSchema = z.object({
	id: z.string(),
	nama: z.string(),
	tahunAkademikId: z.string(),
});
export type Semester = z.infer<typeof SemesterSchema>;

export const MataKuliahSchema = z.object({
	id: z.string(),
	kode: z.string(),
	nama: z.string(),
	sks: z.number().int().default(2),
	prodiId: z.string(),
	semesterId: z.string(),
});
export type MataKuliah = z.infer<typeof MataKuliahSchema>;

// ---------------- User & Role ----------------
export const UserSchema = z.object({
	id: z.string(),
	username: z.string().min(3),
	passwordHash: z.string(),
	namaLengkap: z.string(),
	role: RoleEnum,
	allowedTopikIds: z.array(z.string()).default([]),
	groupId: z.string().optional(),
	prodiId: z.string().optional(),
	mataKuliahIds: z.array(z.string()).default([]),
	detail: z.string().optional(),
	aktif: z.boolean().default(true),
	createdAt: z.number(),
});
export type User = z.infer<typeof UserSchema>;

export const GroupSchema = z.object({
	id: z.string(),
	nama: z.string(),
	keterangan: z.string().default(""),
	prodiId: z.string().optional(),
});
export type Group = z.infer<typeof GroupSchema>;

// ---------------- Bank Soal ----------------
export const ModulSchema = z.object({
	id: z.string(),
	nama: z.string(),
	aktif: z.boolean().default(true),
	mataKuliahId: z.string().optional(),
});
export type Modul = z.infer<typeof ModulSchema>;

export const TopikSchema = z.object({
	id: z.string(),
	modulId: z.string(),
	nama: z.string(),
});
export type Topik = z.infer<typeof TopikSchema>;

export const JawabanSchema = z.object({
	id: z.string(),
	detail: z.string(),
	benar: z.boolean(),
});
export type Jawaban = z.infer<typeof JawabanSchema>;

export const SoalSchema = z.object({
	id: z.string(),
	topikId: z.string(),
	detail: z.string(),
	tipe: TipeSoalEnum,
	kesulitan: KesulitanEnum,
	audioFileId: z.string().optional(),
	audioPlayOnce: z.boolean().default(false),
	jawaban: z.array(JawabanSchema).default([]),
	pembahasan: z.string().default(""),
	createdAt: z.number(),
});
export type Soal = z.infer<typeof SoalSchema>;

// ---------------- Paket Ujian ----------------
export const TopicSetSchema = z.object({
	id: z.string(),
	topikId: z.string(),
	tipe: TipeSoalEnum.optional(),
	kesulitan: KesulitanEnum.optional(),
	jumlah: z.number().int().positive(),
	jumlahOpsi: z.number().int().positive().default(4),
	acakSoal: z.boolean().default(true),
	acakJawaban: z.boolean().default(true),
});
export type TopicSet = z.infer<typeof TopicSetSchema>;

export const UjianSchema = z.object({
	id: z.string(),
	nama: z.string(),
	deskripsi: z.string().default(""),
	durasiMenit: z.number().int().positive(),
	poinBenar: z.number().default(1),
	poinSalah: z.number().default(0),
	poinKosong: z.number().default(0),
	beginAt: z.number().optional(),
	endAt: z.number().optional(),
	tokenAktif: z.boolean().default(false),
	// ipRange: stored but NOT enforced (Issue #13, V1 hide-and-document). No UI
	// input exposes it today; real CIDR/IP enforcement is deferred to V2.
	ipRange: z.string().default(""),
	groupIds: z.array(z.string()).default([]),
	mataKuliahId: z.string().optional(),
	semesterId: z.string().optional(),
	topicSets: z.array(TopicSetSchema).default([]),
	showResult: z.boolean().default(true),
	showResultDetail: z.boolean().default(false),
	fullscreenWajib: z.boolean().default(true),
	maxPindahTab: z.number().int().nonnegative().default(3),
	blokirShortcut: z.boolean().default(true),
	mode: z.enum(["online", "offline"]).default("online"),
	createdBy: z.string(),
	createdAt: z.number(),
});
export type Ujian = z.infer<typeof UjianSchema>;

export const TokenUjianSchema = z.object({
	id: z.string(),
	ujianId: z.string(),
	kode: z.string(),
	dipakaiOleh: z.string().optional(),
	dipakaiAt: z.number().optional(),
});
export type TokenUjian = z.infer<typeof TokenUjianSchema>;

// ---------------- Sesi & Hasil ----------------
export const JawabanSesiSchema = z.object({
	soalId: z.string(),
	jawabanIds: z.array(z.string()).default([]),
	jawabanEssay: z.string().default(""),
	ragu: z.boolean().default(false),
	skor: z.number().optional(),
	catatanGrader: z.string().optional(),
});
export type JawabanSesi = z.infer<typeof JawabanSesiSchema>;

export const SesiUjianSchema = z.object({
	id: z.string(),
	ujianId: z.string(),
	pesertaId: z.string(),
	status: StatusSesiEnum,
	mulaiAt: z.number().optional(),
	selesaiAt: z.number().optional(),
	endsAt: z.number().optional(),
	soalIds: z.array(z.string()).default([]),
	jawabanOrder: z.record(z.string(), z.array(z.string())).default({}),
	jawaban: z.array(JawabanSesiSchema).default([]),
	pelanggaran: z.number().default(0),
	skorTotal: z.number().optional(),
	maxSkor: z.number().optional(),
	gradedAt: z.number().optional(),
	gradedBy: z.string().optional(),
	createdAt: z.number(),
});
export type SesiUjian = z.infer<typeof SesiUjianSchema>;

// ---------------- Config ----------------
// Nav keys for RBAC menu access
export const NAV_KEYS = [
	"dashboard",
	"users",
	"akademik",
	"peserta",
	"modul",
	"files",
	"ujian",
	"hasil",
	"evaluasi",
	"laporan",
	"leaderboard",
	"pengaturan",
	"tools",
] as const;
export type NavKey = (typeof NAV_KEYS)[number];

export const ConfigSchema = z.object({
	appName: z.string().default("CBT-Kampus"),
	appLogo: z.string().default(""),
	appDeskripsi: z.string().default("Aplikasi ujian berbasis komputer"),
	pesanLogin: z.string().default("Selamat datang di aplikasi ujian online"),
	// mobileLock / multiDevice: stored but NOT enforced (Issue #13, V1
	// hide-and-document). The settings UI shows these disabled with a "Belum
	// diberlakukan" badge so they cannot imply protection. Real device/session
	// enforcement is deferred to V2 (see deferred-work.md).
	mobileLock: z.boolean().default(false),
	multiDevice: z.boolean().default(false),
	// RBAC menu matrix per role -> array of nav keys allowed
	roleAccess: z.record(z.string(), z.array(z.string())).default({}),
});
export type AppConfig = z.infer<typeof ConfigSchema>;
