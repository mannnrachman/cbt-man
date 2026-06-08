import {
  getCbtSnapshot,
  mutateEntity,
  saveConfigServer,
} from "@/lib/server/repos/functions";
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
    loadPromise = getCbtSnapshot().then((snapshot) => {
      applySnapshot(snapshot);
    });
  }
  await loadPromise;
}

function upsertArrayItem<T extends { id: string }>(list: T[], item: T) {
  const idx = list.findIndex((entry) => entry.id === item.id);
  if (idx >= 0) list[idx] = item;
  else list.push(item);
}

function createRepo<T extends { id: string }>(
  entity: "users" | "groups" | "modul" | "topik" | "soal" | "ujian" | "token" | "sesi",
  getList: () => T[],
  setList: (items: T[]) => void,
) {
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
      void mutateEntity({ data: { entity, action: "upsert", payload: item } });
      return item;
    },
    remove(id: string): void {
      setList(getList().filter((item) => item.id !== id));
      void mutateEntity({ data: { entity, action: "remove", payload: { id } } });
    },
    bulkSet(items: T[]): void {
      setList(items.slice());
      void mutateEntity({ data: { entity, action: "bulkSet", payload: items } });
    },
  };
}

export const usersRepo = createRepo("users", () => cache.users, (items) => {
  cache.users = items;
});
export const groupsRepo = createRepo("groups", () => cache.groups, (items) => {
  cache.groups = items;
});
export const modulRepo = createRepo("modul", () => cache.modul, (items) => {
  cache.modul = items;
});
export const topikRepo = createRepo("topik", () => cache.topik, (items) => {
  cache.topik = items;
});
export const soalRepo = createRepo("soal", () => cache.soal, (items) => {
  cache.soal = items;
});
export const ujianRepo = createRepo("ujian", () => cache.ujian, (items) => {
  cache.ujian = items;
});
export const tokenRepo = createRepo("token", () => cache.token, (items) => {
  cache.token = items;
});
export const sesiRepo = createRepo("sesi", () => cache.sesi, (items) => {
  cache.sesi = items;
});

export const configRepo = {
  get(): AppConfig {
    return cache.config;
  },
  set(cfg: AppConfig): void {
    cache.config = cfg;
    void saveConfigServer({ data: cfg });
  },
};
