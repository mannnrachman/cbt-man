/* eslint-disable @typescript-eslint/no-explicit-any */
import { getCbtSnapshot, getPublicBootConfigServer } from "@/lib/server/snapshot/functions";
import { claimExamToken as claimExamTokenServer, saveConfigServer, mutateUjianServer, mutateTokenServer } from "@/lib/server/ujian/functions";
import { mutateUserServer } from "@/lib/server/users/functions";
import { mutateModulServer, mutateTopikServer, mutateSoalServer } from "@/lib/server/modul/functions";
import { mutateSesiServer, createSesiServer, saveParticipantSesiServer } from "@/lib/server/sesi/functions";
import { getTodaysExamsServer } from "@/lib/server/exams";
import { 
	mutateUnitAkademikServer, 
	mutateTahunAkademikServer, mutateSemesterServer, mutateMataKuliahServer 
} from "@/lib/server/akademik/functions";
import { mutatePenawaranMembershipServer } from "@/lib/server/akademik/functions";
import { toast } from "sonner";
import { participantQuestionId } from "./session-answers";
import type {
	AppConfig,

	Modul,
	NavKey,
	SesiUjian,
	Soal,
	TokenUjian,
	Topik,
	Ujian,
	User,
	UnitAkademik,
	TahunAkademik,
	Semester,
	MataKuliah,
	PenawaranMataKuliah,
	PublicExamSchedule,
} from "./types";

type Snapshot = Awaited<ReturnType<typeof getCbtSnapshot>>;
export type PublicBootConfig = Awaited<
	ReturnType<typeof getPublicBootConfigServer>
>;

type MutationResult = { ok: boolean; error?: string };
type EntityName =
	| "users"
	| "unitAkademik"
	| "tahunAkademik"
	| "semester"
	| "mataKuliah"
	| "penawaran"
	| "modul"
	| "topik"
	| "soal"
	| "ujian"
	| "token"
	| "sesi";

const DEFAULT_OPERATOR_NAV: NavKey[] = [
	"dashboard",
	"peserta",
	"modul",
	"files",
	"ujian",
	"hasil",
	"evaluasi",
	"laporan",
	"leaderboard",
];

const cache = {
	users: [] as User[],
	unitAkademik: [] as UnitAkademik[],
	tahunAkademik: [] as TahunAkademik[],
	semester: [] as Semester[],
	mataKuliah: [] as MataKuliah[],
	penawaran: [] as PenawaranMataKuliah[],
	modul: [] as Modul[],
	topik: [] as Topik[],
	soal: [] as Soal[],
	ujian: [] as Ujian[],
	token: [] as TokenUjian[],
	sesi: [] as SesiUjian[],
	config: {
		appName: "CBT-MAN",
		appLogo: "",
		appDeskripsi: "Aplikasi ujian berbasis komputer",
		pesanLogin: "Selamat datang di aplikasi ujian online",
		mobileLock: false,
		multiDevice: false,
		roleAccess: {
			admin_prodi: DEFAULT_OPERATOR_NAV,
			evaluator: [
				"dashboard",
				"hasil",
				"evaluasi",
				"laporan",
				"leaderboard",
			],
		},
	} as AppConfig,
};

let loadPromise: Promise<void> | null = null;

export function invalidateReposCache(): void {
	loadPromise = null;
}

function applySnapshot(snapshot: Snapshot) {
	cache.users = snapshot.users;
	cache.unitAkademik = snapshot.unitAkademik;
	cache.tahunAkademik = snapshot.tahunAkademik;
	cache.semester = snapshot.semester;
	cache.mataKuliah = snapshot.mataKuliah;
	cache.penawaran = snapshot.penawaran;
	cache.modul = snapshot.modul;
	cache.topik = snapshot.topik;
	cache.soal = snapshot.soal;
	cache.ujian = snapshot.ujian;
	cache.token = snapshot.token;
	cache.sesi = snapshot.sesi;
	cache.config = snapshot.config;
}

export async function hydrateRepos(): Promise<void> {
	if (!loadPromise) {
		loadPromise = getCbtSnapshot()
			.then((snapshot) => {
				applySnapshot(snapshot);
			})
			.catch((error) => {
				loadPromise = null;
				throw error;
			});
	}

	await loadPromise;
}

export async function loadPublicBootConfig(): Promise<PublicBootConfig> {
	return getPublicBootConfigServer();
}

export interface TodaysExams {
	online: PublicExamSchedule[];
	offline: PublicExamSchedule[];
}

export async function getTodaysExams(): Promise<TodaysExams> {
	const result = await getTodaysExamsServer();
	if (!result.ok) return { online: [], offline: [] };
	return { online: result.online, offline: result.offline };
}

export async function claimExamToken(
	ujianId: string,
	kode: string,
): Promise<{ ok: true; token: TokenUjian } | { ok: false; error: string }> {
	const result = await claimExamTokenServer({ data: { ujianId, kode } });
	if (!result.ok) {
		return { ok: false, error: result.error ?? "Unknown error" };
	}
	const next = cache.token.slice();
	upsertArrayItem(next, result.token);
	cache.token = next;
	return { ok: true, token: result.token };
}

export async function createExamSession(
	ujianId: string,
): Promise<{ ok: true; sesiId: string } | { ok: false; error: string }> {
	const result = await createSesiServer({ data: { ujianId } });
	if (!result.ok) {
		return { ok: false, error: result.error ?? "Gagal membuat sesi ujian" };
	}
	return { ok: true, sesiId: result.sesiId };
}

let participantSessionPending: Promise<MutationResult> = Promise.resolve({ ok: true });

export function saveParticipantSession(
	sesi: SesiUjian,
	submit = false,
): Promise<MutationResult> {
	const next = cache.sesi.slice();
	upsertArrayItem(next, submit ? { ...sesi, status: "selesai" } : sesi);
	cache.sesi = next;

	const request = () =>
		saveParticipantSesiServer({
			data: {
				sesiId: sesi.id,
				action: submit ? "submit" : "save",
				jawaban: sesi.jawaban.map(({ soalId, jawabanIds, jawabanEssay, ragu }) => ({
					soalId,
					jawabanIds,
					jawabanEssay,
					ragu,
				})),
			},
		})
			.then((result) => {
				if (!result.ok) {
					notifyMutationFailure("jawaban ujian", result.error ?? "Unknown error");
				}
				return result;
			})
			.catch((error) => {
				const message = error instanceof Error ? error.message : String(error);
				notifyMutationFailure("jawaban ujian", message);
				return { ok: false, error: message };
			});

	participantSessionPending = participantSessionPending.then(request, request);
	return participantSessionPending;
}

function upsertArrayItem<T extends { id: string }>(list: T[], item: T) {
	const idx = list.findIndex((entry) => entry.id === item.id);
	if (idx >= 0) list[idx] = item;
	else list.push(item);
}

function notifyMutationFailure(entity: string, error: string): void {
	toast.error(`Gagal menyimpan ${entity}: ${error}`);
	invalidateReposCache();
	void hydrateRepos().catch(() => undefined);
}

function runEntityMutation(
	entity: EntityName,
	action: "upsert" | "remove" | "bulkSet",
	payload: unknown,
): Promise<MutationResult> {
	let mutationPromise: Promise<{ ok: boolean; error?: string }>;
	
	switch (entity) {
		case "users": mutationPromise = mutateUserServer({ data: { action, payload } }); break;

		case "modul": mutationPromise = mutateModulServer({ data: { action, payload } }); break;
		case "topik": mutationPromise = mutateTopikServer({ data: { action, payload } }); break;
		case "soal": mutationPromise = mutateSoalServer({ data: { action, payload } }); break;
		case "ujian": mutationPromise = mutateUjianServer({ data: { action, payload } }); break;
		case "token": mutationPromise = mutateTokenServer({ data: { action, payload } }); break;
		case "sesi": mutationPromise = mutateSesiServer({ data: { action, payload } }); break;
		case "unitAkademik": mutationPromise = mutateUnitAkademikServer({ data: { action: action as any, payload } }); break;
		case "tahunAkademik": mutationPromise = mutateTahunAkademikServer({ data: { action: action as any, payload } }); break;
		case "semester": mutationPromise = mutateSemesterServer({ data: { action: action as any, payload } }); break;
		case "mataKuliah": mutationPromise = mutateMataKuliahServer({ data: { action: action as any, payload } }); break;
		case "penawaran": mutationPromise = Promise.resolve({ ok: false, error: "Gunakan updateMembership untuk penawaran." }); break;
		default: mutationPromise = Promise.resolve({ ok: false, error: "Unknown entity" });
	}

	return mutationPromise
		.then((result) => {
			if (!result.ok) notifyMutationFailure(entity, result.error ?? "Unknown error");
			return result;
		})
		.catch((error) => {
			const message = error instanceof Error ? error.message : String(error);
			notifyMutationFailure(entity, message);
			return { ok: false, error: message };
		});
}

function createRepo<T extends { id: string }>(
	entity: EntityName,
	getList: () => T[],
	setList: (items: T[]) => void,
) {
	let pending: Promise<MutationResult> | null = null;

	function enqueue(
		action: "upsert" | "remove" | "bulkSet",
		payload: unknown,
	): void {
		pending = Promise.resolve(pending).then(() =>
			runEntityMutation(entity, action, payload),
		);
	}

	return {
		all(): T[] {
			return getList().slice();
		},
		byId(id: string): T | undefined {
			return getList().find((item) => item.id === id);
		},
		upsert(item: T): T {
			const next = getList().slice();
			upsertArrayItem(next, item);
			setList(next);
			enqueue("upsert", item);
			return item;
		},
		remove(id: string): void {
			setList(getList().filter((item) => item.id !== id));
			enqueue("remove", { id });
		},
		bulkSet(items: T[]): void {
			setList(items.slice());
			enqueue("bulkSet", items);
		},
		async flush(): Promise<MutationResult> {
			const current = pending;
			if (!current) return { ok: true };
			const result = await current;
			if (pending === current) pending = null;
			return result;
		},
	};
}

export const usersRepo = createRepo(
	"users",
	() => cache.users,
	(items) => {
		cache.users = items;
	},
);

export const unitAkademikRepo = createRepo(
	"unitAkademik",
	() => cache.unitAkademik,
	(items) => {
		cache.unitAkademik = items;
	},
);

export const tahunAkademikRepo = createRepo(
	"tahunAkademik",
	() => cache.tahunAkademik,
	(items) => {
		cache.tahunAkademik = items;
	},
);

export const semesterRepo = createRepo(
	"semester",
	() => cache.semester,
	(items) => {
		cache.semester = items;
	},
);

export const mataKuliahRepo = createRepo(
	"mataKuliah",
	() => cache.mataKuliah,
	(items) => {
		cache.mataKuliah = items;
	},
);

export const modulRepo = createRepo(
	"modul",
	() => cache.modul,
	(items) => {
		cache.modul = items;
	},
);

export const topikRepo = createRepo(
	"topik",
	() => cache.topik,
	(items) => {
		cache.topik = items;
	},
);

export const soalRepo = createRepo(
	"soal",
	() => cache.soal,
	(items) => {
		cache.soal = items;
	},
);

export function soalBySessionId(sessionId: string, soalId: string): Soal | undefined {
	return soalRepo.byId(participantQuestionId(sessionId, soalId));
}

export const ujianRepo = createRepo(
	"ujian",
	() => cache.ujian,
	(items) => {
		cache.ujian = items;
	},
);

let penawaranMembershipPending: Promise<MutationResult> = Promise.resolve({ ok: true });

export const penawaranRepo = {
	all: () => cache.penawaran.map((item) => ({ ...item, pengampuIds: [...item.pengampuIds], pesertaIds: [...item.pesertaIds] })),
	byId: (id: string) => {
		const item = cache.penawaran.find((value) => value.id === id);
		return item ? { ...item, pengampuIds: [...item.pengampuIds], pesertaIds: [...item.pesertaIds] } : undefined;
	},
	updateMembership(item: PenawaranMataKuliah): void {
		const previous = cache.penawaran.find((value) => value.id === item.id);
		if (!previous) {
			notifyMutationFailure("penawaran", "Kelas mata kuliah tidak ditemukan.");
			return;
		}
		const expectedPengampuIds = [...previous.pengampuIds];
		const expectedPesertaIds = [...previous.pesertaIds];
		upsertArrayItem(cache.penawaran, item);
		const request = () => mutatePenawaranMembershipServer({
			data: {
				id: item.id,
				expectedPengampuIds,
				expectedPesertaIds,
				pengampuIds: item.pengampuIds,
				pesertaIds: item.pesertaIds,
			},
		}).then((result) => {
			if (!result.ok) {
				notifyMutationFailure("penawaran", result.error ?? "Unknown error");
				return result;
			}
			const current = cache.penawaran.find((value) => value.id === item.id);
			if (current && JSON.stringify(current.pengampuIds) === JSON.stringify(item.pengampuIds)
				&& JSON.stringify(current.pesertaIds) === JSON.stringify(item.pesertaIds)) {
				upsertArrayItem(cache.penawaran, result.penawaran);
			}
			return result;
		}).catch((error) => {
			const message = error instanceof Error ? error.message : String(error);
			notifyMutationFailure("penawaran", message);
			return { ok: false as const, error: message };
		});
		penawaranMembershipPending = penawaranMembershipPending.then(request, request);
	},
};

export const tokenRepo = createRepo(
	"token",
	() => cache.token,
	(items) => {
		cache.token = items;
	},
);

export const sesiRepo = createRepo(
	"sesi",
	() => cache.sesi,
	(items) => {
		cache.sesi = items;
	},
);

let configPending: Promise<MutationResult> | null = null;

function runConfigMutation(cfg: AppConfig): Promise<MutationResult> {
	return saveConfigServer({ data: cfg })
		.then((result) => {
			if (!result.ok) notifyMutationFailure("config", result.error);
			return result;
		})
		.catch((error) => {
			const message = error instanceof Error ? error.message : String(error);
			notifyMutationFailure("config", message);
			return { ok: false, error: message };
		});
}

export const configRepo = {
	get(): AppConfig {
		return cache.config;
	},
	set(cfg: AppConfig): void {
		cache.config = cfg;
		configPending = Promise.resolve(configPending).then(() =>
			runConfigMutation(cfg),
		);
	},
	async flush(): Promise<MutationResult> {
		const current = configPending;
		if (!current) return { ok: true };
		const result = await current;
		if (configPending === current) configPending = null;
		return result;
	},
};
