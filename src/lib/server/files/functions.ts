import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { uid } from "@/lib/server/db/id";

const uploadsDir = resolve(process.cwd(), "data", "uploads");

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

async function ensureUploadsDir() {
  await mkdir(uploadsDir, { recursive: true });
}

function filePath(id: string, extension: string) {
  return join(uploadsDir, `${id}${extension}`);
}

function metaPath(id: string) {
  return join(uploadsDir, `${id}.json`);
}

async function readMeta(id: string): Promise<StoredFileRecord | null> {
  try {
    const raw = await readFile(metaPath(id), "utf8");
    return fileSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

async function listMetas(): Promise<StoredFileRecord[]> {
  await ensureUploadsDir();
  const entries = await readdir(uploadsDir);
  const metas = await Promise.all(
    entries
      .filter((entry) => entry.endsWith(".json"))
      .map(async (entry) => {
        try {
          const raw = await readFile(join(uploadsDir, entry), "utf8");
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

export const listStoredFiles = createServerFn({ method: "GET" }).handler(async () => {
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
    await ensureUploadsDir();
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

    await writeFile(filePath(id, extension), buffer);
    await writeFile(metaPath(id), JSON.stringify(meta, null, 2));
    return meta;
  });

export const deleteStoredFile = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    const meta = await readMeta(data.id);
    if (!meta) return { ok: true as const };

    await rm(filePath(meta.id, meta.extension), { force: true });
    await rm(metaPath(meta.id), { force: true });
    return { ok: true as const };
  });

export const getStoredFileUrl = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    const meta = await readMeta(data.id);
    if (!meta) return null;

    const absPath = filePath(meta.id, meta.extension);
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

// Export seluruh file asset (meta + blob base64) untuk paket backup.
export const exportFilesServer = createServerFn({ method: "GET" }).handler(async () => {
  const metas = await listMetas();
  const files = await Promise.all(
    metas.map(async (meta) => {
      const body = await readFile(filePath(meta.id, meta.extension));
      return { ...meta, dataBase64: body.toString("base64") };
    }),
  );
  return files;
});

// Restore file asset dari paket backup (overwrite existing di data/uploads/).
export const importFilesServer = createServerFn({ method: "POST" })
  .validator(z.array(fileBackupSchema))
  .handler(async ({ data }) => {
    await ensureUploadsDir();
    for (const item of data) {
      const buffer = Buffer.from(item.dataBase64, "base64");
      await writeFile(filePath(item.id, item.extension), buffer);
      const meta: StoredFileRecord = {
        id: item.id,
        name: item.name,
        mime: item.mime,
        size: item.size,
        createdAt: item.createdAt,
        extension: item.extension,
      };
      await writeFile(metaPath(item.id), JSON.stringify(meta, null, 2));
    }
    return { ok: true as const };
  });
