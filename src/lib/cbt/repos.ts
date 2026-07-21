/* eslint-disable @typescript-eslint/no-explicit-any */
import { getCbtSnapshot, getPublicBootConfigServer } from "@/lib/server/snapshot/functions";
import { claimExamToken as claimExamTokenServer, saveConfigServer, mutateUjianServer, mutateTokenServer } from "@/lib/server/ujian/functions";
import { mutateUserServer, mutateGroupServer } from "@/lib/server/users/functions";
import { mutateModulServer, mutateTopikServer, mutateSoalServer } from "@/lib/server/modul/functions";
import { mutateSesiServer } from "@/lib/server/sesi/functions";
import { getTodaysExamsServer } from "@/lib/server/exams";
import { 
	mutateFakultasServer, mutateJurusanServer, mutateProdiServer, 
	mutateTahunAkademikServer, mutateSemesterServer, mutateMataKuliahServer 
} from "@/lib/server/akademik/functions";
import { toast } from "sonner";
import type {
	AppConfig,
	Group,
	Modul,
	NavKey,
	SesiUjian,
	Soal,
	TokenUjian,
	Topik,
	Ujian,
	User,
	Fakultas,
	Jurusan,
	ProgramStudi,
	TahunAkademik,
	Semester,
	MataKuliah,
} from "./types";

type Snapshot = Awaited<ReturnType<typeof getCbtSnapshot>>;
export type PublicBootConfig = Awaited<
	ReturnType<typeof getPublicBootConfigServer>
>;

type MutationResult = { ok: boolean; error?: string };
type EntityName =
	| "users"
	| "groups"
	| "fakultas"
	| "jurusan"
	| "prodi"
	| "tahunAkademik"
	| "semester"
	| "mataKuliah"
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
	groups: [] as Group[],
	fakultas: [] as Fakultas[],
	jurusan: [] as Jurusan[],
	prodi: [] as ProgramStudi[],
	tahunAkademik: [] as TahunAkademik[],
	semester: [] as Semester[],
	mataKuliah: [] as MataKuliah[],
	modul: [] as Modul[],
	topik: [] as Topik[],
	soal: [] as Soal[],
	ujian: [] as Ujian[],
	token: [] as TokenUjian[],
	sesi: [] as SesiUjian[],
	config: {
		appName: "CBT-Kampus",
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
	cache.groups = snapshot.groups;
	cache.fakultas = snapshot.fakultas;
	cache.jurusan = snapshot.jurusan;
	cache.prodi = snapshot.prodi;
	cache.tahunAkademik = snapshot.tahunAkademik;
	cache.semester = snapshot.semester;
	cache.mataKuliah = snapshot.mataKuliah;
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
	online: Ujian[];
	offline: Ujian[];
}

export async function getTodaysExams(): Promise<TodaysExams> {
	const result = await getTodaysExamsServer();
	if (!result.ok) return { online: [], offline: [] };
	return { online: result.online, offline: result.offline };
}

// Atomic single-use token claim (Issue #9). The server performs the
// conditional update; on success we patch the local cache so a subsequent
// `tokenRepo.byId`/`all()` read reflects the claim without a full re-hydrate.
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
		case "groups": mutationPromise = mutateGroupServer({ data: { action, payload } }); break;
		case "modul": mutationPromise = mutateModulServer({ data: { action, payload } }); break;
		case "topik": mutationPromise = mutateTopikServer({ data: { action, payload } }); break;
		case "soal": mutationPromise = mutateSoalServer({ data: { action, payload } }); break;
		case "ujian": mutationPromise = mutateUjianServer({ data: { action, payload } }); break;
		case "token": mutationPromise = mutateTokenServer({ data: { action, payload } }); break;
		case "sesi": mutationPromise = mutateSesiServer({ data: { action, payload } }); break;
		case "fakultas": mutationPromise = mutateFakultasServer({ data: { action: action as any, payload } }); break;
		case "jurusan": mutationPromise = mutateJurusanServer({ data: { action: action as any, payload } }); break;
		case "prodi": mutationPromise = mutateProdiServer({ data: { action: action as any, payload } }); break;
		case "tahunAkademik": mutationPromise = mutateTahunAkademikServer({ data: { action: action as any, payload } }); break;
		case "semester": mutationPromise = mutateSemesterServer({ data: { action: action as any, payload } }); break;
		case "mataKuliah": mutationPromise = mutateMataKuliahServer({ data: { action: action as any, payload } }); break;
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

export const groupsRepo = createRepo(
	"groups",
	() => cache.groups,
	(items) => {
		cache.groups = items;
	},
);

export const fakultasRepo = createRepo(
	"fakultas",
	() => cache.fakultas,
	(items) => {
		cache.fakultas = items;
	},
);

export const jurusanRepo = createRepo(
	"jurusan",
	() => cache.jurusan,
	(items) => {
		cache.jurusan = items;
	},
);

export const prodiRepo = createRepo(
	"prodi",
	() => cache.prodi,
	(items) => {
		cache.prodi = items;
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

export const ujianRepo = createRepo(
	"ujian",
	() => cache.ujian,
	(items) => {
		cache.ujian = items;
	},
);

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
