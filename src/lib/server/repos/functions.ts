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
const entitySchema = z.enum(["users", "groups", "modul", "topik", "soal", "ujian", "token", "sesi"]);

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

function mapSoal(row: Awaited<ReturnType<typeof prisma.soal.findMany>>[number] & { jawaban: { id: string; detail: string; benar: boolean }[] }): Soal {
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
      roleAccess: parseJson(config?.roleAccess, { operator: ["dashboard", "peserta", "modul", "files", "ujian", "hasil", "evaluasi", "laporan", "leaderboard"] }),
    },
  };
}

async function seedIfNeeded() {
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
}

export const getCbtSnapshot = createServerFn({ method: "GET" }).handler(async () => {
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
    return { ok: true as const, user: mapUser(user) };
  });

export const mutateEntity = createServerFn({ method: "POST" })
  .validator(z.object({ entity: entitySchema, action: z.enum(["upsert", "remove", "bulkSet"]), payload: z.any() }))
  .handler(async ({ data }) => {
    await seedIfNeeded();
    const { entity, action, payload } = data;
    if (entity === "users") {
      if (action === "remove") await prisma.user.delete({ where: { id: String(payload.id) } });
      else if (action === "bulkSet") {
        await prisma.user.deleteMany();
        for (const item of payload as User[]) {
          await prisma.user.create({ data: { ...item, allowedTopikIds: stringifyJson(item.allowedTopikIds), groupId: item.groupId ?? null, detail: item.detail ?? null, createdAt: BigInt(item.createdAt) } });
        }
      } else {
        const item = payload as User;
        await prisma.user.upsert({ where: { id: item.id }, update: { username: item.username, passwordHash: item.passwordHash, namaLengkap: item.namaLengkap, role: item.role, allowedTopikIds: stringifyJson(item.allowedTopikIds), groupId: item.groupId ?? null, detail: item.detail ?? null, aktif: item.aktif, createdAt: BigInt(item.createdAt) }, create: { id: item.id, username: item.username, passwordHash: item.passwordHash, namaLengkap: item.namaLengkap, role: item.role, allowedTopikIds: stringifyJson(item.allowedTopikIds), groupId: item.groupId ?? null, detail: item.detail ?? null, aktif: item.aktif, createdAt: BigInt(item.createdAt) } });
      }
    }
    if (entity === "groups") {
      if (action === "remove") await prisma.group.delete({ where: { id: String(payload.id) } });
      else if (action === "bulkSet") { await prisma.group.deleteMany(); await prisma.group.createMany({ data: payload as Group[] }); }
      else await prisma.group.upsert({ where: { id: payload.id }, update: payload, create: payload });
    }
    if (entity === "modul") {
      if (action === "remove") await prisma.modul.delete({ where: { id: String(payload.id) } });
      else if (action === "bulkSet") { await prisma.modul.deleteMany(); await prisma.modul.createMany({ data: payload as Modul[] }); }
      else await prisma.modul.upsert({ where: { id: payload.id }, update: payload, create: payload });
    }
    if (entity === "topik") {
      if (action === "remove") await prisma.topik.delete({ where: { id: String(payload.id) } });
      else if (action === "bulkSet") { await prisma.topik.deleteMany(); await prisma.topik.createMany({ data: payload as Topik[] }); }
      else await prisma.topik.upsert({ where: { id: payload.id }, update: payload, create: payload });
    }
    if (entity === "soal") {
      if (action === "remove") await prisma.soal.delete({ where: { id: String(payload.id) } });
      else if (action === "bulkSet") {
        await prisma.jawaban.deleteMany();
        await prisma.soal.deleteMany();
        for (const item of payload as Soal[]) {
          await prisma.soal.create({ data: { id: item.id, topikId: item.topikId, detail: item.detail, tipe: item.tipe, kesulitan: item.kesulitan, audioFileId: item.audioFileId ?? null, audioPlayOnce: item.audioPlayOnce, pembahasan: item.pembahasan, createdAt: BigInt(item.createdAt), jawaban: { create: item.jawaban } } });
        }
      } else {
        const item = payload as Soal;
        await prisma.soal.upsert({ where: { id: item.id }, update: { topikId: item.topikId, detail: item.detail, tipe: item.tipe, kesulitan: item.kesulitan, audioFileId: item.audioFileId ?? null, audioPlayOnce: item.audioPlayOnce, pembahasan: item.pembahasan, createdAt: BigInt(item.createdAt) }, create: { id: item.id, topikId: item.topikId, detail: item.detail, tipe: item.tipe, kesulitan: item.kesulitan, audioFileId: item.audioFileId ?? null, audioPlayOnce: item.audioPlayOnce, pembahasan: item.pembahasan, createdAt: BigInt(item.createdAt) } });
        await prisma.jawaban.deleteMany({ where: { soalId: item.id } });
        await prisma.jawaban.createMany({ data: item.jawaban.map((jawaban) => ({ ...jawaban, soalId: item.id })) });
      }
    }
    if (entity === "ujian") {
      if (action === "remove") await prisma.ujian.delete({ where: { id: String(payload.id) } });
      else if (action === "bulkSet") {
        await prisma.ujian.deleteMany();
        for (const item of payload as Ujian[]) {
          await prisma.ujian.create({ data: { ...item, beginAt: toBigInt(item.beginAt), endAt: toBigInt(item.endAt), groupIds: stringifyJson(item.groupIds), topicSets: stringifyJson(item.topicSets), createdAt: BigInt(item.createdAt) } });
        }
      } else {
        const item = payload as Ujian;
        await prisma.ujian.upsert({ where: { id: item.id }, update: { ...item, beginAt: toBigInt(item.beginAt), endAt: toBigInt(item.endAt), groupIds: stringifyJson(item.groupIds), topicSets: stringifyJson(item.topicSets), createdAt: BigInt(item.createdAt) }, create: { ...item, beginAt: toBigInt(item.beginAt), endAt: toBigInt(item.endAt), groupIds: stringifyJson(item.groupIds), topicSets: stringifyJson(item.topicSets), createdAt: BigInt(item.createdAt) } });
      }
    }
    if (entity === "token") {
      if (action === "remove") await prisma.tokenUjian.delete({ where: { id: String(payload.id) } });
      else if (action === "bulkSet") {
        await prisma.tokenUjian.deleteMany();
        await prisma.tokenUjian.createMany({ data: (payload as TokenUjian[]).map((item) => ({ ...item, dipakaiOleh: item.dipakaiOleh ?? null, dipakaiAt: toBigInt(item.dipakaiAt) })) });
      } else {
        const item = payload as TokenUjian;
        await prisma.tokenUjian.upsert({ where: { id: item.id }, update: { ujianId: item.ujianId, kode: item.kode, dipakaiOleh: item.dipakaiOleh ?? null, dipakaiAt: toBigInt(item.dipakaiAt) }, create: { id: item.id, ujianId: item.ujianId, kode: item.kode, dipakaiOleh: item.dipakaiOleh ?? null, dipakaiAt: toBigInt(item.dipakaiAt) } });
      }
    }
    if (entity === "sesi") {
      if (action === "remove") await prisma.sesiUjian.delete({ where: { id: String(payload.id) } });
      else if (action === "bulkSet") {
        await prisma.sesiUjian.deleteMany();
        await prisma.sesiUjian.createMany({ data: (payload as SesiUjian[]).map((item) => ({ ...item, mulaiAt: toBigInt(item.mulaiAt), selesaiAt: toBigInt(item.selesaiAt), endsAt: toBigInt(item.endsAt), soalIds: stringifyJson(item.soalIds), jawabanOrder: stringifyJson(item.jawabanOrder), jawaban: stringifyJson(item.jawaban), gradedAt: toBigInt(item.gradedAt), gradedBy: item.gradedBy ?? null, createdAt: BigInt(item.createdAt) })) });
      } else {
        const item = payload as SesiUjian;
        await prisma.sesiUjian.upsert({ where: { id: item.id }, update: { ujianId: item.ujianId, pesertaId: item.pesertaId, status: item.status, mulaiAt: toBigInt(item.mulaiAt), selesaiAt: toBigInt(item.selesaiAt), endsAt: toBigInt(item.endsAt), soalIds: stringifyJson(item.soalIds), jawabanOrder: stringifyJson(item.jawabanOrder), jawaban: stringifyJson(item.jawaban), pelanggaran: item.pelanggaran, skorTotal: item.skorTotal ?? null, maxSkor: item.maxSkor ?? null, gradedAt: toBigInt(item.gradedAt), gradedBy: item.gradedBy ?? null, createdAt: BigInt(item.createdAt) }, create: { id: item.id, ujianId: item.ujianId, pesertaId: item.pesertaId, status: item.status, mulaiAt: toBigInt(item.mulaiAt), selesaiAt: toBigInt(item.selesaiAt), endsAt: toBigInt(item.endsAt), soalIds: stringifyJson(item.soalIds), jawabanOrder: stringifyJson(item.jawabanOrder), jawaban: stringifyJson(item.jawaban), pelanggaran: item.pelanggaran, skorTotal: item.skorTotal ?? null, maxSkor: item.maxSkor ?? null, gradedAt: toBigInt(item.gradedAt), gradedBy: item.gradedBy ?? null, createdAt: BigInt(item.createdAt) } });
      }
    }
    return { ok: true as const };
  });

export const saveConfigServer = createServerFn({ method: "POST" })
  .validator(z.object({ appName: z.string(), appDeskripsi: z.string(), pesanLogin: z.string(), mobileLock: z.boolean(), multiDevice: z.boolean(), roleAccess: z.record(z.string(), z.array(z.string())) }))
  .handler(async ({ data }) => {
    await seedIfNeeded();
    await prisma.appConfig.upsert({ where: { id: "app" }, update: { ...data, roleAccess: stringifyJson(data.roleAccess) }, create: { id: "app", ...data, roleAccess: stringifyJson(data.roleAccess) } });
    return { ok: true as const };
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
        await tx.user.create({ data: { ...item, allowedTopikIds: stringifyJson(item.allowedTopikIds), groupId: item.groupId ?? null, detail: item.detail ?? null, createdAt: BigInt(item.createdAt) } });
      }
      for (const item of data.soal as Soal[]) {
        await tx.soal.create({ data: { id: item.id, topikId: item.topikId, detail: item.detail, tipe: item.tipe, kesulitan: item.kesulitan, audioFileId: item.audioFileId ?? null, audioPlayOnce: item.audioPlayOnce, pembahasan: item.pembahasan, createdAt: BigInt(item.createdAt), jawaban: { create: item.jawaban } } });
      }
      for (const item of data.ujian as Ujian[]) {
        await tx.ujian.create({ data: { ...item, beginAt: toBigInt(item.beginAt), endAt: toBigInt(item.endAt), groupIds: stringifyJson(item.groupIds), topicSets: stringifyJson(item.topicSets), createdAt: BigInt(item.createdAt) } });
      }
      if (data.token.length) {
        await tx.tokenUjian.createMany({ data: (data.token as TokenUjian[]).map((item) => ({ ...item, dipakaiOleh: item.dipakaiOleh ?? null, dipakaiAt: toBigInt(item.dipakaiAt) })) });
      }
      if (data.sesi.length) {
        await tx.sesiUjian.createMany({ data: (data.sesi as SesiUjian[]).map((item) => ({ ...item, mulaiAt: toBigInt(item.mulaiAt), selesaiAt: toBigInt(item.selesaiAt), endsAt: toBigInt(item.endsAt), soalIds: stringifyJson(item.soalIds), jawabanOrder: stringifyJson(item.jawabanOrder), jawaban: stringifyJson(item.jawaban), gradedAt: toBigInt(item.gradedAt), gradedBy: item.gradedBy ?? null, createdAt: BigInt(item.createdAt) })) });
      }
      await tx.appConfig.create({ data: { id: "app", ...data.config, roleAccess: stringifyJson((data.config as AppConfig).roleAccess) } });
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
