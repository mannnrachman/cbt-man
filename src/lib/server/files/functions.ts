import { createServerFn } from "@tanstack/react-start";
import { uid } from "@/lib/server/db/id.server";
import { z } from "zod";


import { prisma } from "@/lib/server/db/prisma";
import { parseJson } from "@/lib/server/db/json";
import { readSessionToken, validateSession } from "@/lib/server/db/session";
import {
  operatorCanTouchTopikId,
  operatorCanTouchUjian,
  pesertaCanTouchUjian,
} from "@/lib/server/db/auth";
import type { NavKey, Role } from "@/lib/cbt/types";
import type { UserRow } from "@/lib/server/repos/mappers";

const uploadsDir = [process.cwd(), "data", "uploads"] as const;
const DEFAULT_OPERATOR_ROLE_ACCESS: NavKey[] = [
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

type StoredFileRecord = {
  id: string;
  name: string;
  mime: string;
  size: number;
  createdAt: number;
  extension: string;
  jurusanId?: string;
};

const fileSchema = z.object({
  id: z.string(),
  name: z.string(),
  mime: z.string(),
  size: z.number(),
  createdAt: z.number(),
  extension: z.string().default(""),
  jurusanId: z.string().optional(),
});

export const fileBackupSchema = z.object({
  id: z.string(),
  name: z.string(),
  mime: z.string(),
  size: z.number(),
  createdAt: z.number(),
  extension: z.string(),
  dataBase64: z.string(),
  jurusanId: z.string().optional(),
});
export type FileBackup = z.infer<typeof fileBackupSchema>;

type FileLockWaiter = { exclusive: boolean; resolve: () => void };

let activeReaders = 0;
let writerActive = false;
const fileLockWaiters: FileLockWaiter[] = [];

function flushFileLockWaiters() {
  if (writerActive) return;
  const nextWrite = fileLockWaiters.find((waiter) => waiter.exclusive);
  if (nextWrite) {
    if (activeReaders > 0) return;
    fileLockWaiters.splice(fileLockWaiters.indexOf(nextWrite), 1);
    writerActive = true;
    nextWrite.resolve();
    return;
  }
  while (fileLockWaiters[0] && !fileLockWaiters[0].exclusive) {
    activeReaders += 1;
    fileLockWaiters.shift()!.resolve();
  }
}

export async function withFileReadLock<T>(operation: () => Promise<T>): Promise<T> {
  await new Promise<void>((resolve) => {
    if (!writerActive && !fileLockWaiters.some((waiter) => waiter.exclusive)) {
      activeReaders += 1;
      resolve();
      return;
    }
    fileLockWaiters.push({ exclusive: false, resolve });
  });
  try {
    return await operation();
  } finally {
    activeReaders -= 1;
    flushFileLockWaiters();
  }
}

// Writes stay exclusive so restore promotion cannot race uploads. Reads share the lock.
export async function withFileOperationLock<T>(operation: () => Promise<T>): Promise<T> {
  await new Promise<void>((resolve) => {
    if (!writerActive && activeReaders === 0 && fileLockWaiters.length === 0) {
      writerActive = true;
      resolve();
      return;
    }
    fileLockWaiters.push({ exclusive: true, resolve });
  });
  try {
    return await operation();
  } finally {
    writerActive = false;
    flushFileLockWaiters();
  }
}

async function pathApi() {
  return import("node:path");
}

async function fsApi() {
  return import("node:fs/promises");
}

async function resolveUploadsDir() {
  const { resolve } = await pathApi();
  return resolve(...uploadsDir);
}

async function ensureUploadsDir() {
  const [{ mkdir }, baseDir] = await Promise.all([fsApi(), resolveUploadsDir()]);
  await mkdir(baseDir, { recursive: true });
}

async function filePath(id: string, extension: string) {
  const [{ join }, baseDir] = await Promise.all([pathApi(), resolveUploadsDir()]);
  return join(baseDir, `${id}${extension}`);
}

async function metaPath(id: string) {
  const [{ join }, baseDir] = await Promise.all([pathApi(), resolveUploadsDir()]);
  return join(baseDir, `${id}.json`);
}

async function readMeta(id: string): Promise<StoredFileRecord | null> {
  try {
    const [{ readFile }, target] = await Promise.all([fsApi(), metaPath(id)]);
    const raw = await readFile(target, "utf8");
    return fileSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

async function listMetas(): Promise<StoredFileRecord[]> {
  await ensureUploadsDir();
  const [{ readdir, readFile }, { join }, baseDir] = await Promise.all([
    fsApi(),
    pathApi(),
    resolveUploadsDir(),
  ]);
  const entries = await readdir(baseDir);
  const metas = await Promise.all(
    entries
      .filter((entry) => entry.endsWith(".json"))
      .map(async (entry) => {
        try {
          const raw = await readFile(join(baseDir, entry), "utf8");
          return fileSchema.parse(JSON.parse(raw));
        } catch {
          return null;
        }
      }),
  );

  return metas
    .filter((item): item is StoredFileRecord => item !== null)
    .sort((a, b) => b.createdAt - a.createdAt);
}

async function requireCaller() {
  return validateSession(readSessionToken());
}

async function operatorHasFilesAccess(callerRole: string) {
  const config = await prisma.appConfig.findUnique({
    where: { id: "app" },
    select: { roleAccess: true },
  });
  const roleAccess = parseJson<Record<string, string[]>>(config?.roleAccess, {
    admin_prodi: [...DEFAULT_OPERATOR_ROLE_ACCESS],
    evaluator: ["dashboard", "hasil", "evaluasi", "laporan", "leaderboard"],
  });
  const access = roleAccess[callerRole] ?? [];
  return new Set((access ?? []) as NavKey[]).has("files");
}

async function requireFileManagerAccess() {
  const caller = await requireCaller();
  if (!caller) return { ok: false as const, error: "Forbidden" };
  if (caller.role === "super_admin") return { ok: true as const, caller };
  if ((caller.role === "admin_prodi" || caller.role === "evaluator") && (await operatorHasFilesAccess(caller.role)))
    return { ok: true as const, caller };
  return { ok: false as const, error: "Forbidden" };
}

async function requireAdmin() {
  const caller = await requireCaller();
  if (!caller || caller.role !== "super_admin") return { ok: false as const, error: "Forbidden" };
  return { ok: true as const, caller };
}

// Extract file manager ids referenced as `file://<id>` inside rich-text HTML.
// Mirrors the client `extractFileIds` pattern in src/lib/cbt/files.ts.
function extractFileIds(html: string): string[] {
  const ids: string[] = [];
  const re = /file:\/\/([a-z0-9_]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) ids.push(match[1]);
  return ids;
}

// Issue #2: a peserta may read a file blob ONLY if that file could legitimately
// appear in content the snapshot already exposes to them — i.e. the `deskripsi`
// of an exam assigned to their group, or the `detail`/`audioFileId` of a soal
// that is part of one of THEIR sesi for such an exam. Files embedded in a
// soal's `pembahasan` are only exposed once that sesi is finished AND the exam
// publishes result detail. This mirrors `pesertaSnapshot`
// (repos/snapshot.ts) so authorization and visibility stay consistent, and
// prevents a peserta from fetching arbitrary file ids.
async function pesertaCanAccessFile(
  caller: { id: string; role: Role; unitId: string | null },
  fileId: string,
): Promise<boolean> {
  // Group-assigned exams: groupIds empty (open to all) OR includes the group.
  const ujianRows = await prisma.ujian.findMany({
    select: { id: true, groupIds: true, deskripsi: true, showResult: true, showResultDetail: true, status: true },
  });
  const assigned = [];
  for (const u of ujianRows) {
    if (u.status === "published" && await pesertaCanTouchUjian(caller, u.id)) assigned.push(u);
  }
  const assignedById = new Map(assigned.map((u) => [u.id, u]));
  const allowed = new Set<string>();
  for (const u of assigned) {
    for (const id of extractFileIds(u.deskripsi)) allowed.add(id);
  }
  if (allowed.has(fileId)) return true;

  // Soal referenced by the peserta's own sesi for those assigned exams.
  const sesiRows = await prisma.sesiUjian.findMany({
    where: { pesertaId: caller.id },
    select: { ujianId: true, soalIds: true, status: true },
  });
  const soalIds = new Set<string>();
  // Pembahasan reveal policy, mirroring pesertaSnapshot: only finished sesi of
  // exams that publish result detail reveal pembahasan; redaction wins when a
  // soal is shared with a non-revealed sesi.
  const revealed = new Set<string>();
  const withheld = new Set<string>();
  for (const s of sesiRows) {
    const ujian = assignedById.get(s.ujianId);
    if (!ujian) continue;
    const canReveal = s.status === "selesai" && ujian.showResult && ujian.showResultDetail;
    for (const sid of parseJson<string[]>(s.soalIds, [])) {
      soalIds.add(sid);
      (canReveal ? revealed : withheld).add(sid);
    }
  }
  for (const id of withheld) revealed.delete(id);
  if (soalIds.size === 0) return false;

  const soalRows = await prisma.soal.findMany({
    where: { id: { in: [...soalIds] } },
    select: {
      id: true,
      detail: true,
      pembahasan: true,
      audioFileId: true,
      jawaban: { select: { detail: true } },
    },
  });
  for (const soal of soalRows) {
    if (soal.audioFileId && soal.audioFileId === fileId) return true;
    for (const id of extractFileIds(soal.detail)) allowed.add(id);
    if (revealed.has(soal.id)) {
      for (const id of extractFileIds(soal.pembahasan)) allowed.add(id);
    }
    // Answer-option detail is rich text rendered to peserta via RichView
    // (kerjakan/hasil pages), so its embedded file:// images must be allowed.
    for (const j of soal.jawaban) {
      for (const id of extractFileIds(j.detail)) allowed.add(id);
    }
  }
  return allowed.has(fileId);
}

async function operatorCanAccessFile(
  caller: UserRow,
  fileId: string,
  meta: StoredFileRecord,
): Promise<boolean> {
  if (caller.role === "super_admin") return true;
  if (caller.role !== "admin_prodi" && caller.role !== "evaluator") return false;
  if (meta.jurusanId && meta.jurusanId !== caller.unitId) return false;

  const marker = `file://${fileId}`;
  const [soals, ujians] = await Promise.all([
    prisma.soal.findMany({
      where: {
        OR: [
          { audioFileId: fileId },
          { detail: { contains: marker } },
          { pembahasan: { contains: marker } },
          { jawaban: { some: { detail: { contains: marker } } } },
        ],
      },
      select: { topikId: true },
    }),
    prisma.ujian.findMany({
      where: { deskripsi: { contains: marker } },
      select: { id: true },
    }),
  ]);

  for (const soal of soals) {
    if (await operatorCanTouchTopikId(caller, soal.topikId)) return true;
  }
  for (const ujian of ujians) {
    if (await operatorCanTouchUjian(caller, ujian.id)) return true;
  }

  // Unreferenced files follow the file-manager list boundary.
  return (
    soals.length === 0 &&
    ujians.length === 0 &&
    meta.jurusanId === caller.unitId &&
    (await operatorHasFilesAccess(caller.role))
  );
}

export const listStoredFiles = createServerFn({ method: "GET" }).handler(async () => {
  const auth = await requireFileManagerAccess();
  if (!auth.ok) throw new Error(auth.error);
  const files = await withFileReadLock(() => listMetas());
  return auth.caller.role === "super_admin"
    ? files
    : files.filter((file) => file.jurusanId === auth.caller.unitId);
});

export const uploadStoredFile = createServerFn({ method: "POST" })
  .validator(
    z.object({
      name: z.string().min(1),
      mime: z.string().min(1),
      dataBase64: z.string().min(1),
      jurusanId: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const auth = await requireFileManagerAccess();
    if (!auth.ok) throw new Error(auth.error);

    return withFileOperationLock(async () => {
      await ensureUploadsDir();
      const [{ extname }, { writeFile }] = await Promise.all([pathApi(), fsApi()]);
      const id = uid("f_");
      const extension = extname(data.name).slice(0, 16);
      if (extension.toLowerCase() === ".json") throw new Error("Ekstensi .json dicadangkan untuk metadata file");
      const buffer = Buffer.from(data.dataBase64, "base64");
      const meta: StoredFileRecord = {
        id,
        name: data.name,
        mime: data.mime,
        size: buffer.byteLength,
        createdAt: Date.now(),
        extension,
        jurusanId: auth.caller.role === "super_admin" ? data.jurusanId : auth.caller.unitId ?? undefined,
      };

      await writeFile(await filePath(id, extension), buffer);
      await writeFile(await metaPath(id), JSON.stringify(meta, null, 2));
      return meta;
    });
  });

export const deleteStoredFile = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    const auth = await requireAdmin();
    if (!auth.ok) return { ok: false as const, error: auth.error };

    return withFileOperationLock(async () => {
      const meta = await readMeta(data.id);
      if (!meta) return { ok: true as const };

      const { rm } = await fsApi();
      await rm(await filePath(meta.id, meta.extension), { force: true });
      await rm(await metaPath(meta.id), { force: true });
      return { ok: true as const };
    });
  });

export const getStoredFileUrl = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    const caller = await requireCaller();
    if (!caller) throw new Error("Forbidden");

    const meta = await readMeta(data.id);
    if (!meta) return null;

    if (caller.role === "admin_prodi" || caller.role === "evaluator") {
      if (!(await operatorCanAccessFile(caller, data.id, meta))) throw new Error("Forbidden");
    } else if (caller.role === "mahasiswa") {
      if (!(await pesertaCanAccessFile(caller, data.id))) throw new Error("Forbidden");
    } else if (caller.role !== "super_admin") {
      throw new Error("Forbidden");
    }

    return withFileReadLock(async () => {
      const meta = await readMeta(data.id);
      if (!meta) return null;

      const [{ stat, readFile }, absPath] = await Promise.all([
        fsApi(),
        filePath(meta.id, meta.extension),
      ]);
      const info = await stat(absPath);
      if (!info.isFile()) return null;

      const body = await readFile(absPath);
      return {
        mime: meta.mime,
        dataBase64: body.toString("base64"),
      };
    });
  });

export const exportFilesServer = createServerFn({ method: "GET" }).handler(async () => {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  return withFileReadLock(async () => {
    const metas = await listMetas();
    const { readFile } = await fsApi();
    return Promise.all(
      metas.map(async (meta) => {
        const body = await readFile(await filePath(meta.id, meta.extension));
        return { ...meta, dataBase64: body.toString("base64") };
      }),
    );
  });
});

export type FileRestorePlan = {
  baseDir: string;
  stageDir: string;
  previousDir?: string;
};

export async function stageFileRestore(data: FileBackup[]): Promise<FileRestorePlan> {
  const [{ mkdir, mkdtemp, rm, writeFile }, { dirname, join }] = await Promise.all([fsApi(), pathApi()]);
  const baseDir = await resolveUploadsDir();
  await mkdir(baseDir, { recursive: true });
  const stageDir = await mkdtemp(join(dirname(baseDir), ".uploads-restore-"));
  const ids = new Set<string>();
  try {
    for (const item of fileBackupSchema.array().parse(data)) {
      if (!/^[A-Za-z0-9_-]+$/.test(item.id)) throw new Error("ID file tidak valid");
      if (ids.has(item.id)) throw new Error("ID file duplikat");
      ids.add(item.id);
      if (item.extension !== "" && !/^\.[A-Za-z0-9]{1,16}$/.test(item.extension)) {
        throw new Error("Ekstensi file tidak valid");
      }
      if (item.extension.toLowerCase() === ".json") throw new Error("Ekstensi .json dicadangkan untuk metadata file");
      const buffer = Buffer.from(item.dataBase64, "base64");
      if (buffer.length !== item.size) throw new Error(`Ukuran file ${item.name} tidak sesuai`);
      const meta: StoredFileRecord = { ...item };
      await writeFile(join(stageDir, `${item.id}${item.extension}`), buffer);
      await writeFile(join(stageDir, `${item.id}.json`), JSON.stringify(meta, null, 2));
    }
    return { baseDir, stageDir };
  } catch (error) {
    await rm(stageDir, { recursive: true, force: true });
    throw error;
  }
}

export async function promoteFileRestore(plan: FileRestorePlan): Promise<void> {
  const { rename, rm } = await fsApi();
  const previousDir = `${plan.baseDir}.previous`;
  await rm(previousDir, { recursive: true, force: true });
  await rename(plan.baseDir, previousDir);
  plan.previousDir = previousDir;
  await rename(plan.stageDir, plan.baseDir);
}

export async function rollbackFileRestore(plan: FileRestorePlan): Promise<void> {
  const { rm, rename } = await fsApi();
  if (plan.previousDir) {
    await rm(plan.baseDir, { recursive: true, force: true });
    await rename(plan.previousDir, plan.baseDir);
  }
  await rm(plan.stageDir, { recursive: true, force: true });
}

export async function finalizeFileRestore(plan: FileRestorePlan): Promise<void> {
  const { rm } = await fsApi();
  try {
    if (plan.previousDir) await rm(plan.previousDir, { recursive: true, force: true });
  } catch (error) {
    console.error("Failed to remove previous uploads after restore", error);
  }
  try {
    await rm(plan.stageDir, { recursive: true, force: true });
  } catch (error) {
    console.error("Failed to remove staged uploads after restore", error);
  }
}

export const importFilesServer = createServerFn({ method: "POST" })
  .validator(z.array(fileBackupSchema))
  .handler(async ({ data }) => {
    const auth = await requireAdmin();
    if (!auth.ok) return { ok: false as const, error: auth.error };
    try {
      return await withFileOperationLock(async () => {
        const plan = await stageFileRestore(data);
        try {
          await promoteFileRestore(plan);
        } catch (error) {
          await rollbackFileRestore(plan);
          throw error;
        }
        await finalizeFileRestore(plan);
        return { ok: true as const };
      });
    } catch (error) {
      console.error("Failed to restore files", error);
      return { ok: false as const, error: "Berkas backup gagal dipulihkan" };
    }
  });
