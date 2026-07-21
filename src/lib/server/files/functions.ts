import { createServerFn } from "@tanstack/react-start";
import { uid } from "@/lib/server/db/id.server";
import { z } from "zod";


import { prisma } from "@/lib/server/db/prisma";
import { parseJson } from "@/lib/server/db/json";
import { readSessionToken, validateSession } from "@/lib/server/db/session";
import type { NavKey } from "@/lib/cbt/types";

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
};

const fileSchema = z.object({
  id: z.string(),
  name: z.string(),
  mime: z.string(),
  size: z.number(),
  createdAt: z.number(),
  extension: z.string().default(""),
});

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
// of an exam assigned to their group, or the `detail`/`pembahasan`/`audioFileId`
// of a soal that is part of one of THEIR sesi for such an exam. This mirrors
// `pesertaSnapshot` (repos/functions.ts) so authorization and visibility stay
// consistent, and prevents a peserta from fetching arbitrary file ids.
async function pesertaCanAccessFile(
  caller: { id: string; role: string; groupId: string | null },
  fileId: string,
): Promise<boolean> {
  // Group-assigned exams: groupIds empty (open to all) OR includes the group.
  const ujianRows = await prisma.ujian.findMany({
    select: { id: true, groupIds: true, deskripsi: true },
  });
  const assigned = ujianRows.filter((u) => {
    const groupIds = parseJson<string[]>(u.groupIds, []);
    return groupIds.length === 0 || (!!caller.groupId && groupIds.includes(caller.groupId));
  });
  const allowed = new Set<string>();
  for (const u of assigned) {
    for (const id of extractFileIds(u.deskripsi)) allowed.add(id);
  }
  if (allowed.has(fileId)) return true;

  // Soal referenced by the peserta's own sesi for those assigned exams.
  const assignedIds = new Set(assigned.map((u) => u.id));
  const sesiRows = await prisma.sesiUjian.findMany({
    where: { pesertaId: caller.id },
    select: { ujianId: true, soalIds: true },
  });
  const soalIds = new Set<string>();
  for (const s of sesiRows) {
    if (!assignedIds.has(s.ujianId)) continue;
    for (const sid of parseJson<string[]>(s.soalIds, [])) soalIds.add(sid);
  }
  if (soalIds.size === 0) return false;

  const soalRows = await prisma.soal.findMany({
    where: { id: { in: [...soalIds] } },
    select: {
      detail: true,
      pembahasan: true,
      audioFileId: true,
      jawaban: { select: { detail: true } },
    },
  });
  for (const soal of soalRows) {
    if (soal.audioFileId && soal.audioFileId === fileId) return true;
    for (const id of extractFileIds(soal.detail)) allowed.add(id);
    for (const id of extractFileIds(soal.pembahasan)) allowed.add(id);
    // Answer-option detail is rich text rendered to peserta via RichView
    // (kerjakan/hasil pages), so its embedded file:// images must be allowed.
    for (const j of soal.jawaban) {
      for (const id of extractFileIds(j.detail)) allowed.add(id);
    }
  }
  return allowed.has(fileId);
}

export const listStoredFiles = createServerFn({ method: "GET" }).handler(async () => {
  const auth = await requireFileManagerAccess();
  if (!auth.ok) throw new Error(auth.error);
  return listMetas();
});

export const uploadStoredFile = createServerFn({ method: "POST" })
  .validator(
    z.object({
      name: z.string().min(1),
      mime: z.string().min(1),
      dataBase64: z.string().min(1),
    }),
  )
  .handler(async ({ data }) => {
    const auth = await requireFileManagerAccess();
    if (!auth.ok) throw new Error(auth.error);

    await ensureUploadsDir();
    const [{ extname }, { writeFile }] = await Promise.all([pathApi(), fsApi()]);
    const id = uid("f_");
    const extension = extname(data.name).slice(0, 16);
    const buffer = Buffer.from(data.dataBase64, "base64");
    const meta: StoredFileRecord = {
      id,
      name: data.name,
      mime: data.mime,
      size: buffer.byteLength,
      createdAt: Date.now(),
      extension,
    };

    await writeFile(await filePath(id, extension), buffer);
    await writeFile(await metaPath(id), JSON.stringify(meta, null, 2));
    return meta;
  });

export const deleteStoredFile = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    const auth = await requireAdmin();
    if (!auth.ok) return { ok: false as const, error: auth.error };

    const meta = await readMeta(data.id);
    if (!meta) return { ok: true as const };

    const { rm } = await fsApi();
    await rm(await filePath(meta.id, meta.extension), { force: true });
    await rm(await metaPath(meta.id), { force: true });
    return { ok: true as const };
  });

export const getStoredFileUrl = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    const caller = await requireCaller();
    if (!caller) throw new Error("Forbidden");

    // Authorize by role (Issue #2). Admin and operators may read any blob:
    // operators legitimately view exam/soal images (hasil/evaluasi/laporan)
    // based on their topik scope, independent of the file-manager nav, so
    // gating reads behind the "files" management nav would break those images.
    // A peserta is scoped to files referenced by exams/soal they can access;
    // everyone else is denied.
    if (caller.role === "super_admin" || caller.role === "admin_prodi" || caller.role === "evaluator") {
      // allowed
    } else if (caller.role === "mahasiswa") {
      if (!(await pesertaCanAccessFile(caller, data.id))) throw new Error("Forbidden");
    } else {
      throw new Error("Forbidden");
    }

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

const fileBackupSchema = z.object({
  id: z.string(),
  name: z.string(),
  mime: z.string(),
  size: z.number(),
  createdAt: z.number(),
  extension: z.string(),
  dataBase64: z.string(),
});

export const exportFilesServer = createServerFn({ method: "GET" }).handler(async () => {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  const metas = await listMetas();
  const { readFile } = await fsApi();
  const files = await Promise.all(
    metas.map(async (meta) => {
      const body = await readFile(await filePath(meta.id, meta.extension));
      return { ...meta, dataBase64: body.toString("base64") };
    }),
  );
  return files;
});

export const importFilesServer = createServerFn({ method: "POST" })
  .validator(z.array(fileBackupSchema))
  .handler(async ({ data }) => {
    const auth = await requireAdmin();
    if (!auth.ok) return { ok: false as const, error: auth.error };

    await ensureUploadsDir();
    const [{ resolve, sep }, { writeFile }] = await Promise.all([pathApi(), fsApi()]);
    const baseDir = await resolveUploadsDir();
    for (const item of data) {
      if (!/^[A-Za-z0-9_-]+$/.test(item.id)) continue;
      if (item.extension !== "" && !/^\.[A-Za-z0-9]{1,16}$/.test(item.extension)) continue;
      const blobPath = resolve(await filePath(item.id, item.extension));
      if (!blobPath.startsWith(baseDir + sep)) continue;
      const buffer = Buffer.from(item.dataBase64, "base64");
      await writeFile(blobPath, buffer);
      const meta: StoredFileRecord = {
        id: item.id,
        name: item.name,
        mime: item.mime,
        size: item.size,
        createdAt: item.createdAt,
        extension: item.extension,
      };
      await writeFile(await metaPath(item.id), JSON.stringify(meta, null, 2));
    }
    return { ok: true as const };
  });
