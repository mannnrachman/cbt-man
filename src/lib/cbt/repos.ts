import {
  claimExamToken as claimExamTokenServer,
  getCbtSnapshot,
  getPublicBootConfigServer,
  mutateEntity,
  saveConfigServer,
} from "@/lib/server/repos/functions";
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
} from "./types";

type Snapshot = Awaited<ReturnType<typeof getCbtSnapshot>>;
export type PublicBootConfig = Awaited<ReturnType<typeof getPublicBootConfigServer>>;

type MutationResult = { ok: boolean; error?: string };
type EntityName = "users" | "groups" | "modul" | "topik" | "soal" | "ujian" | "token" | "sesi";

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
  modul: [] as Modul[],
  topik: [] as Topik[],
  soal: [] as Soal[],
  ujian: [] as Ujian[],
  token: [] as TokenUjian[],
  sesi: [] as SesiUjian[],
  config: {
    appName: "CBT-MAN",
    appDeskripsi: "Aplikasi ujian berbasis komputer",
    pesanLogin: "Selamat datang di aplikasi ujian online",
    mobileLock: false,
    multiDevice: false,
    roleAccess: { operator: DEFAULT_OPERATOR_NAV },
  } as AppConfig,
};

let loadPromise: Promise<void> | null = null;

export function invalidateReposCache(): void {
  loadPromise = null;
}

function applySnapshot(snapshot: Snapshot) {
  cache.users = snapshot.users;
  cache.groups = snapshot.groups;
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

// Atomic single-use token claim (Issue #9). The server performs the
// conditional update; on success we patch the local cache so a subsequent
// `tokenRepo.byId`/`all()` read reflects the claim without a full re-hydrate.
export async function claimExamToken(
  ujianId: string,
  kode: string,
): Promise<{ ok: true; token: TokenUjian } | { ok: false; error: string }> {
  const result = await claimExamTokenServer({ data: { ujianId, kode } });
  if (result.ok) {
    const next = cache.token.slice();
    upsertArrayItem(next, result.token);
    cache.token = next;
    return { ok: true, token: result.token };
  }
  return { ok: false, error: result.error };
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
  return mutateEntity({ data: { entity, action, payload } })
    .then((result) => {
      if (!result.ok) notifyMutationFailure(entity, result.error);
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

  function enqueue(action: "upsert" | "remove" | "bulkSet", payload: unknown): void {
    pending = Promise.resolve(pending).then(() => runEntityMutation(entity, action, payload));
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
    configPending = Promise.resolve(configPending).then(() => runConfigMutation(cfg));
  },
  async flush(): Promise<MutationResult> {
    const current = configPending;
    if (!current) return { ok: true };
    const result = await current;
    if (configPending === current) configPending = null;
    return result;
  },
};
