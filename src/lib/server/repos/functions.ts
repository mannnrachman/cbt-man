import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { hashPassword, verifyPassword } from "@/lib/cbt/hash";
import type {
  AppConfig,
  Group,
  Modul,
  Soal,
  SesiUjian,
  TokenUjian,
  Topik,
  Ujian,
  User,
} from "@/lib/cbt/types";
import { prisma } from "@/lib/server/db/prisma";
import { parseJson, stringifyJson, toBigInt, toNumber } from "@/lib/server/db/json";
import { uid } from "@/lib/server/db/id";
import { createSeedDataset, seedDatabase } from "@/lib/server/db/seed-shared.mjs";
import {
  clearSessionCookie,
  createSession,
  deleteSession,
  deleteSessionsForUser,
  readSessionToken,
  setSessionCookie,
  validateSession,
} from "@/lib/server/db/session";

export type Snapshot = {
  users: User[];
  groups: Group[];
  modul: Modul[];
  topik: Topik[];
  soal: Soal[];
  ujian: Ujian[];
  token: TokenUjian[];
  sesi: SesiUjian[];
  config: AppConfig;
};

const roleSchema = z.enum(["admin", "operator", "peserta"]);
const entitySchema = z.enum([
  "users",
  "groups",
  "modul",
  "topik",
  "soal",
  "ujian",
  "token",
  "sesi",
]);

function mapUser(row: Awaited<ReturnType<typeof prisma.user.findMany>>[number]): User {
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.passwordHash,
    namaLengkap: row.namaLengkap,
    role: row.role,
    allowedTopikIds: parseJson(row.allowedTopikIds, []),
    groupId: row.groupId ?? undefined,
    detail: row.detail ?? undefined,
    aktif: row.aktif,
    createdAt: Number(row.createdAt),
  };
}

/**
 * Versi `mapUser` untuk jalur AUTENTIKASI (loginServer/validateSessionServer):
 * `passwordHash` di-strip ("") agar tak pernah mencapai client store (frozen Never,
 * menghindari regresi 7-4). `mapUser` (dengan hash) tetap dipakai untuk cache snapshot
 * `usersRepo` yang diandalkan edit password admin.
 */
function publicUser(row: Awaited<ReturnType<typeof prisma.user.findMany>>[number]): User {
  return { ...mapUser(row), passwordHash: "" };
}

function mapSoal(
  row: Awaited<ReturnType<typeof prisma.soal.findMany>>[number] & {
    jawaban: { id: string; detail: string; benar: boolean }[];
  },
): Soal {
  return {
    id: row.id,
    topikId: row.topikId,
    detail: row.detail,
    tipe: row.tipe,
    kesulitan: row.kesulitan,
    audioFileId: row.audioFileId ?? undefined,
    audioPlayOnce: row.audioPlayOnce,
    jawaban: row.jawaban.map((item) => ({ id: item.id, detail: item.detail, benar: item.benar })),
    pembahasan: row.pembahasan,
    createdAt: Number(row.createdAt),
  };
}

function mapUjian(row: Awaited<ReturnType<typeof prisma.ujian.findMany>>[number]): Ujian {
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
    topicSets: parseJson(row.topicSets, []),
    showResult: row.showResult,
    showResultDetail: row.showResultDetail,
    fullscreenWajib: row.fullscreenWajib,
    maxPindahTab: row.maxPindahTab,
    blokirShortcut: row.blokirShortcut,
    createdBy: row.createdBy,
    createdAt: Number(row.createdAt),
  };
}

function mapSesi(row: Awaited<ReturnType<typeof prisma.sesiUjian.findMany>>[number]): SesiUjian {
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

async function buildSnapshot(): Promise<Snapshot> {
  const [users, groups, modul, topik, soal, ujian, token, sesi, config] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.group.findMany({ orderBy: { nama: "asc" } }),
    prisma.modul.findMany({ orderBy: { nama: "asc" } }),
    prisma.topik.findMany({ orderBy: { nama: "asc" } }),
    prisma.soal.findMany({ include: { jawaban: true }, orderBy: { createdAt: "asc" } }),
    prisma.ujian.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.tokenUjian.findMany({ orderBy: { kode: "asc" } }),
    prisma.sesiUjian.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.appConfig.findUnique({ where: { id: "app" } }),
  ]);

  return {
    users: users.map(mapUser),
    groups,
    modul,
    topik,
    soal: soal.map(mapSoal),
    ujian: ujian.map(mapUjian),
    token: token.map((row) => ({
      id: row.id,
      ujianId: row.ujianId,
      kode: row.kode,
      dipakaiOleh: row.dipakaiOleh ?? undefined,
      dipakaiAt: toNumber(row.dipakaiAt),
    })),
    sesi: sesi.map(mapSesi),
    config: {
      appName: config?.appName ?? "CBT-MAN",
      appDeskripsi: config?.appDeskripsi ?? "Aplikasi ujian berbasis komputer",
      pesanLogin: config?.pesanLogin ?? "Selamat datang di aplikasi ujian online",
      mobileLock: config?.mobileLock ?? false,
      multiDevice: config?.multiDevice ?? false,
      roleAccess: parseJson(config?.roleAccess, {
        operator: [
          "dashboard",
          "peserta",
          "modul",
          "files",
          "ujian",
          "hasil",
          "evaluasi",
          "laporan",
          "leaderboard",
        ],
      }),
    },
  };
}

let seedPromise: Promise<void> | null = null;

// Single-flight: concurrent callers (mis. beberapa route loader + auth refresh
// mengakses getCbtSnapshot di DB kosong) share satu in-flight seed, mencegah
// race deleteMany/insert yang bisa saling menghapus data.
function seedIfNeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = (async () => {
      const count = await prisma.user.count();
      if (count > 0) return;

      const dataset = await createSeedDataset({
        uid,
        now: Date.now(),
        hashPassword,
      });

      await seedDatabase({
        prisma,
        dataset,
        stringifyJson,
      });
    })().finally(() => {
      seedPromise = null;
    });
  }
  return seedPromise;
}

export const getCbtSnapshot = createServerFn({ method: "GET" }).handler(async () => {
  await seedIfNeeded();
  return buildSnapshot();
});

export const ensureSeedServer = createServerFn({ method: "POST" }).handler(async () => {
  await seedIfNeeded();
  return { ok: true as const };
});

export const loginServer = createServerFn({ method: "POST" })
  .validator(z.object({ username: z.string().min(1), password: z.string().min(1) }))
  .handler(async ({ data }) => {
    await seedIfNeeded();
    const user = await prisma.user.findUnique({ where: { username: data.username } });
    if (!user) return { ok: false as const, error: "Username tidak ditemukan" };
    if (!user.aktif) return { ok: false as const, error: "Akun dinonaktifkan" };
    const ok = await verifyPassword(data.password, user.passwordHash);
    if (!ok) return { ok: false as const, error: "Password salah" };
    // Buat sesi server-side + set cookie httpOnly. Cookie kini sumber otoritatif autentikasi.
    const token = await createSession(user.id);
    setSessionCookie(token);
    return { ok: true as const, user: publicUser(user) };
  });

/**
 * Validasi sesi dari cookie — dipanggil `_authenticated.beforeLoad` tiap navigasi
 * route protected. Sumber otoritatif: cookie httpOnly → row Session → expiry + `aktif`.
 * Fail-closed: bila throw (mis. DB bermasalah), anggap belum auth → beforeLoad redirect /login.
 */
export const validateSessionServer = createServerFn({ method: "POST" }).handler(async () => {
  try {
    // seedIfNeeded di dalam try: bila seed throw (DB kosong/gangguan), fail-closed → null.
    await seedIfNeeded();
    const userRow = await validateSession(readSessionToken());
    return { user: userRow ? publicUser(userRow) : null };
  } catch {
    return { user: null };
  }
});

/** Logout: hapus row Session + clear cookie. Sesi tak bisa dihidupkan ulang tanpa login baru. */
export const logoutServer = createServerFn({ method: "POST" }).handler(async () => {
  await seedIfNeeded();
  await deleteSession(readSessionToken());
  clearSessionCookie();
  return { ok: true as const };
});

/**
 * Admin: revoke semua sesi seorang user (force-logout instan, terpisah dari flag aktif).
 * Cookie korban tetap di browser mereka, tapi row Session hilang → ditolak di navigasi berikut.
 */
export const revokeUserSessionsServer = createServerFn({ method: "POST" })
  .validator(z.object({ userId: z.string().min(1) }))
  .handler(async ({ data }) => {
    await seedIfNeeded();
    // Authorization: server fns adalah RPC — guard route tak cukup. Hanya admin boleh revoke.
    const caller = await validateSession(readSessionToken());
    if (!caller || caller.role !== "admin") {
      return { ok: false as const, error: "Forbidden", deleted: 0 };
    }
    const deleted = await deleteSessionsForUser(data.userId);
    return { ok: true as const, deleted };
  });

export const mutateEntity = createServerFn({ method: "POST" })
  .validator(
    z.object({
      entity: entitySchema,
      action: z.enum(["upsert", "remove", "bulkSet"]),
      payload: z.any(),
    }),
  )
  .handler(async ({ data }) => {
    try {
      await seedIfNeeded();
      const { entity, action, payload } = data;
      if (entity === "users") {
        await prisma.$transaction(async (tx) => {
          if (action === "remove") await tx.user.delete({ where: { id: String(payload.id) } });
          else if (action === "bulkSet") {
            await tx.user.deleteMany();
            for (const item of payload as User[]) {
              await tx.user.create({
                data: {
                  ...item,
                  allowedTopikIds: stringifyJson(item.allowedTopikIds),
                  groupId: item.groupId ?? null,
                  detail: item.detail ?? null,
                  createdAt: BigInt(item.createdAt),
                },
              });
            }
          } else {
            const item = payload as User;
            // Deteksi transisi deaktivasi (aktif true → false) utk revoke sesi instan (atomic dgn upsert).
            const prev = await tx.user.findUnique({
              where: { id: item.id },
              select: { aktif: true },
            });
            await tx.user.upsert({
              where: { id: item.id },
              update: {
                username: item.username,
                passwordHash: item.passwordHash,
                namaLengkap: item.namaLengkap,
                role: item.role,
                allowedTopikIds: stringifyJson(item.allowedTopikIds),
                groupId: item.groupId ?? null,
                detail: item.detail ?? null,
                aktif: item.aktif,
                createdAt: BigInt(item.createdAt),
              },
              create: {
                id: item.id,
                username: item.username,
                passwordHash: item.passwordHash,
                namaLengkap: item.namaLengkap,
                role: item.role,
                allowedTopikIds: stringifyJson(item.allowedTopikIds),
                groupId: item.groupId ?? null,
                detail: item.detail ?? null,
                aktif: item.aktif,
                createdAt: BigInt(item.createdAt),
              },
            });
            // Revoke sesi instan saat deaktivasi (true → false); atomic dalam transaksi yang sama.
            if (prev?.aktif === true && item.aktif === false) {
              await tx.session.deleteMany({ where: { userId: item.id } });
            }
          }
        });
      }
      if (entity === "groups") {
        await prisma.$transaction(async (tx) => {
          if (action === "remove") await tx.group.delete({ where: { id: String(payload.id) } });
          else if (action === "bulkSet") {
            await tx.group.deleteMany();
            await tx.group.createMany({ data: payload as Group[] });
          } else
            await tx.group.upsert({ where: { id: payload.id }, update: payload, create: payload });
        });
      }
      if (entity === "modul") {
        await prisma.$transaction(async (tx) => {
          if (action === "remove") await tx.modul.delete({ where: { id: String(payload.id) } });
          else if (action === "bulkSet") {
            await tx.modul.deleteMany();
            await tx.modul.createMany({ data: payload as Modul[] });
          } else
            await tx.modul.upsert({ where: { id: payload.id }, update: payload, create: payload });
        });
      }
      if (entity === "topik") {
        await prisma.$transaction(async (tx) => {
          if (action === "remove") await tx.topik.delete({ where: { id: String(payload.id) } });
          else if (action === "bulkSet") {
            await tx.topik.deleteMany();
            await tx.topik.createMany({ data: payload as Topik[] });
          } else
            await tx.topik.upsert({ where: { id: payload.id }, update: payload, create: payload });
        });
      }
      if (entity === "soal") {
        await prisma.$transaction(async (tx) => {
          if (action === "remove") await tx.soal.delete({ where: { id: String(payload.id) } });
          else if (action === "bulkSet") {
            await tx.jawaban.deleteMany();
            await tx.soal.deleteMany();
            for (const item of payload as Soal[]) {
              await tx.soal.create({
                data: {
                  id: item.id,
                  topikId: item.topikId,
                  detail: item.detail,
                  tipe: item.tipe,
                  kesulitan: item.kesulitan,
                  audioFileId: item.audioFileId ?? null,
                  audioPlayOnce: item.audioPlayOnce,
                  pembahasan: item.pembahasan,
                  createdAt: BigInt(item.createdAt),
                  jawaban: { create: item.jawaban },
                },
              });
            }
          } else {
            const item = payload as Soal;
            await tx.soal.upsert({
              where: { id: item.id },
              update: {
                topikId: item.topikId,
                detail: item.detail,
                tipe: item.tipe,
                kesulitan: item.kesulitan,
                audioFileId: item.audioFileId ?? null,
                audioPlayOnce: item.audioPlayOnce,
                pembahasan: item.pembahasan,
                createdAt: BigInt(item.createdAt),
              },
              create: {
                id: item.id,
                topikId: item.topikId,
                detail: item.detail,
                tipe: item.tipe,
                kesulitan: item.kesulitan,
                audioFileId: item.audioFileId ?? null,
                audioPlayOnce: item.audioPlayOnce,
                pembahasan: item.pembahasan,
                createdAt: BigInt(item.createdAt),
              },
            });
            await tx.jawaban.deleteMany({ where: { soalId: item.id } });
            await tx.jawaban.createMany({
              data: item.jawaban.map((jawaban) => ({ ...jawaban, soalId: item.id })),
            });
          }
        });
      }
      if (entity === "ujian") {
        await prisma.$transaction(async (tx) => {
          if (action === "remove") await tx.ujian.delete({ where: { id: String(payload.id) } });
          else if (action === "bulkSet") {
            await tx.ujian.deleteMany();
            for (const item of payload as Ujian[]) {
              await tx.ujian.create({
                data: {
                  ...item,
                  beginAt: toBigInt(item.beginAt),
                  endAt: toBigInt(item.endAt),
                  groupIds: stringifyJson(item.groupIds),
                  topicSets: stringifyJson(item.topicSets),
                  createdAt: BigInt(item.createdAt),
                },
              });
            }
          } else {
            const item = payload as Ujian;
            await tx.ujian.upsert({
              where: { id: item.id },
              update: {
                ...item,
                beginAt: toBigInt(item.beginAt),
                endAt: toBigInt(item.endAt),
                groupIds: stringifyJson(item.groupIds),
                topicSets: stringifyJson(item.topicSets),
                createdAt: BigInt(item.createdAt),
              },
              create: {
                ...item,
                beginAt: toBigInt(item.beginAt),
                endAt: toBigInt(item.endAt),
                groupIds: stringifyJson(item.groupIds),
                topicSets: stringifyJson(item.topicSets),
                createdAt: BigInt(item.createdAt),
              },
            });
          }
        });
      }
      if (entity === "token") {
        await prisma.$transaction(async (tx) => {
          if (action === "remove")
            await tx.tokenUjian.delete({ where: { id: String(payload.id) } });
          else if (action === "bulkSet") {
            await tx.tokenUjian.deleteMany();
            await tx.tokenUjian.createMany({
              data: (payload as TokenUjian[]).map((item) => ({
                ...item,
                dipakaiOleh: item.dipakaiOleh ?? null,
                dipakaiAt: toBigInt(item.dipakaiAt),
              })),
            });
          } else {
            const item = payload as TokenUjian;
            await tx.tokenUjian.upsert({
              where: { id: item.id },
              update: {
                ujianId: item.ujianId,
                kode: item.kode,
                dipakaiOleh: item.dipakaiOleh ?? null,
                dipakaiAt: toBigInt(item.dipakaiAt),
              },
              create: {
                id: item.id,
                ujianId: item.ujianId,
                kode: item.kode,
                dipakaiOleh: item.dipakaiOleh ?? null,
                dipakaiAt: toBigInt(item.dipakaiAt),
              },
            });
          }
        });
      }
      if (entity === "sesi") {
        await prisma.$transaction(async (tx) => {
          if (action === "remove") await tx.sesiUjian.delete({ where: { id: String(payload.id) } });
          else if (action === "bulkSet") {
            await tx.sesiUjian.deleteMany();
            await tx.sesiUjian.createMany({
              data: (payload as SesiUjian[]).map((item) => ({
                ...item,
                mulaiAt: toBigInt(item.mulaiAt),
                selesaiAt: toBigInt(item.selesaiAt),
                endsAt: toBigInt(item.endsAt),
                soalIds: stringifyJson(item.soalIds),
                jawabanOrder: stringifyJson(item.jawabanOrder),
                jawaban: stringifyJson(item.jawaban),
                gradedAt: toBigInt(item.gradedAt),
                gradedBy: item.gradedBy ?? null,
                createdAt: BigInt(item.createdAt),
              })),
            });
          } else {
            const item = payload as SesiUjian;
            await tx.sesiUjian.upsert({
              where: { id: item.id },
              update: {
                ujianId: item.ujianId,
                pesertaId: item.pesertaId,
                status: item.status,
                mulaiAt: toBigInt(item.mulaiAt),
                selesaiAt: toBigInt(item.selesaiAt),
                endsAt: toBigInt(item.endsAt),
                soalIds: stringifyJson(item.soalIds),
                jawabanOrder: stringifyJson(item.jawabanOrder),
                jawaban: stringifyJson(item.jawaban),
                pelanggaran: item.pelanggaran,
                skorTotal: item.skorTotal ?? null,
                maxSkor: item.maxSkor ?? null,
                gradedAt: toBigInt(item.gradedAt),
                gradedBy: item.gradedBy ?? null,
                createdAt: BigInt(item.createdAt),
              },
              create: {
                id: item.id,
                ujianId: item.ujianId,
                pesertaId: item.pesertaId,
                status: item.status,
                mulaiAt: toBigInt(item.mulaiAt),
                selesaiAt: toBigInt(item.selesaiAt),
                endsAt: toBigInt(item.endsAt),
                soalIds: stringifyJson(item.soalIds),
                jawabanOrder: stringifyJson(item.jawabanOrder),
                jawaban: stringifyJson(item.jawaban),
                pelanggaran: item.pelanggaran,
                skorTotal: item.skorTotal ?? null,
                maxSkor: item.maxSkor ?? null,
                gradedAt: toBigInt(item.gradedAt),
                gradedBy: item.gradedBy ?? null,
                createdAt: BigInt(item.createdAt),
              },
            });
          }
        });
      }
      return { ok: true as const };
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
    }
  });

export const saveConfigServer = createServerFn({ method: "POST" })
  .validator(
    z.object({
      appName: z.string(),
      appDeskripsi: z.string(),
      pesanLogin: z.string(),
      mobileLock: z.boolean(),
      multiDevice: z.boolean(),
      roleAccess: z.record(z.string(), z.array(z.string())),
    }),
  )
  .handler(async ({ data }) => {
    try {
      await seedIfNeeded();
      await prisma.appConfig.upsert({
        where: { id: "app" },
        update: { ...data, roleAccess: stringifyJson(data.roleAccess) },
        create: { id: "app", ...data, roleAccess: stringifyJson(data.roleAccess) },
      });
      return { ok: true as const };
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
    }
  });

export const importBackupServer = createServerFn({ method: "POST" })
  .validator(
    z.object({
      users: z.array(z.any()),
      groups: z.array(z.any()),
      modul: z.array(z.any()),
      topik: z.array(z.any()),
      soal: z.array(z.any()),
      ujian: z.array(z.any()),
      token: z.array(z.any()),
      sesi: z.array(z.any()),
      config: z.any(),
    }),
  )
  .handler(async ({ data }) => {
    await prisma.$transaction(async (tx) => {
      await tx.jawaban.deleteMany();
      await tx.sesiUjian.deleteMany();
      await tx.tokenUjian.deleteMany();
      await tx.soal.deleteMany();
      await tx.ujian.deleteMany();
      await tx.topik.deleteMany();
      await tx.modul.deleteMany();
      await tx.user.deleteMany();
      await tx.group.deleteMany();
      await tx.appConfig.deleteMany();

      if (data.groups.length) await tx.group.createMany({ data: data.groups as Group[] });
      if (data.modul.length) await tx.modul.createMany({ data: data.modul as Modul[] });
      if (data.topik.length) await tx.topik.createMany({ data: data.topik as Topik[] });
      for (const item of data.users as User[]) {
        await tx.user.create({
          data: {
            ...item,
            allowedTopikIds: stringifyJson(item.allowedTopikIds),
            groupId: item.groupId ?? null,
            detail: item.detail ?? null,
            createdAt: BigInt(item.createdAt),
          },
        });
      }
      for (const item of data.soal as Soal[]) {
        await tx.soal.create({
          data: {
            id: item.id,
            topikId: item.topikId,
            detail: item.detail,
            tipe: item.tipe,
            kesulitan: item.kesulitan,
            audioFileId: item.audioFileId ?? null,
            audioPlayOnce: item.audioPlayOnce,
            pembahasan: item.pembahasan,
            createdAt: BigInt(item.createdAt),
            jawaban: { create: item.jawaban },
          },
        });
      }
      for (const item of data.ujian as Ujian[]) {
        await tx.ujian.create({
          data: {
            ...item,
            beginAt: toBigInt(item.beginAt),
            endAt: toBigInt(item.endAt),
            groupIds: stringifyJson(item.groupIds),
            topicSets: stringifyJson(item.topicSets),
            createdAt: BigInt(item.createdAt),
          },
        });
      }
      if (data.token.length) {
        await tx.tokenUjian.createMany({
          data: (data.token as TokenUjian[]).map((item) => ({
            ...item,
            dipakaiOleh: item.dipakaiOleh ?? null,
            dipakaiAt: toBigInt(item.dipakaiAt),
          })),
        });
      }
      if (data.sesi.length) {
        await tx.sesiUjian.createMany({
          data: (data.sesi as SesiUjian[]).map((item) => ({
            ...item,
            mulaiAt: toBigInt(item.mulaiAt),
            selesaiAt: toBigInt(item.selesaiAt),
            endsAt: toBigInt(item.endsAt),
            soalIds: stringifyJson(item.soalIds),
            jawabanOrder: stringifyJson(item.jawabanOrder),
            jawaban: stringifyJson(item.jawaban),
            gradedAt: toBigInt(item.gradedAt),
            gradedBy: item.gradedBy ?? null,
            createdAt: BigInt(item.createdAt),
          })),
        });
      }
      await tx.appConfig.create({
        data: {
          id: "app",
          ...data.config,
          roleAccess: stringifyJson((data.config as AppConfig).roleAccess),
        },
      });
    });

    return { ok: true as const };
  });

export const resetAllDataServer = createServerFn({ method: "POST" }).handler(async () => {
  await prisma.$transaction(async (tx) => {
    await tx.jawaban.deleteMany();
    await tx.sesiUjian.deleteMany();
    await tx.tokenUjian.deleteMany();
    await tx.soal.deleteMany();
    await tx.ujian.deleteMany();
    await tx.topik.deleteMany();
    await tx.modul.deleteMany();
    await tx.user.deleteMany();
    await tx.group.deleteMany();
    await tx.appConfig.deleteMany();
  });

  return { ok: true as const };
});
