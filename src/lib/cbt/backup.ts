// Backup / restore snapshot CBT berbasis database server.
import { z } from "zod";
import { toast } from "sonner";
import {
  usersRepo,
  unitAkademikRepo,
  modulRepo,
  topikRepo,
  soalRepo,
  ujianRepo,
  tokenRepo,
  sesiRepo,
  configRepo,
  hydrateRepos,
  invalidateReposCache,
} from "./repos";
import {
  UserSchema,
  UnitAkademikSchema,
  ModulSchema,
  TopikSchema,
  SoalSchema,
  UjianSchema,
  TokenUjianSchema,
  SesiUjianSchema,
  ConfigSchema,
} from "./types";
import { importBackupServer, resetAllDataServer } from "@/lib/server/backup/functions";
import { exportFilesServer, importFilesServer } from "@/lib/server/files/functions";

const FileBackupSchema = z.object({
  id: z.string(),
  name: z.string(),
  mime: z.string(),
  size: z.number(),
  createdAt: z.number(),
  extension: z.string(),
  dataBase64: z.string(),
});

export const BackupSchema = z.object({
  app: z.literal("cbtman"),
  version: z.literal(1),
  exportedAt: z.number(),
  users: z.array(UserSchema),
  unitAkademik: z.array(UnitAkademikSchema),
  modul: z.array(ModulSchema),
  topik: z.array(TopikSchema),
  soal: z.array(SoalSchema),
  ujian: z.array(UjianSchema),
  token: z.array(TokenUjianSchema),
  sesi: z.array(SesiUjianSchema),
  config: ConfigSchema,
  files: z.array(FileBackupSchema).optional(),
});
export type Backup = z.infer<typeof BackupSchema>;

export async function exportBackup(): Promise<Backup> {
  const files = await exportFilesServer();
  return {
    app: "cbtman",
    version: 1,
    exportedAt: Date.now(),
    users: usersRepo.all(),
    unitAkademik: unitAkademikRepo.all(),
    modul: modulRepo.all(),
    topik: topikRepo.all(),
    soal: soalRepo.all(),
    ujian: ujianRepo.all(),
    token: tokenRepo.all(),
    sesi: sesiRepo.all(),
    config: configRepo.get(),
    files,
  };
}

export async function downloadBackup(): Promise<void> {
  try {
    const data = await exportBackup();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cbtman-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    toast.error("Gagal export backup: " + (e instanceof Error ? e.message : String(e)));
  }
}

export async function importBackup(raw: unknown): Promise<Backup> {
  const data = BackupSchema.parse(raw);
  await importBackupServer({
    data: {
      users: data.users,
      unitAkademik: data.unitAkademik,
      modul: data.modul,
      topik: data.topik,
      soal: data.soal,
      ujian: data.ujian,
      token: data.token,
      sesi: data.sesi,
      config: data.config,
    },
  });
  await importFilesServer({ data: data.files ?? [] });
  invalidateReposCache();
  await hydrateRepos();
  return data;
}

export async function resetAllData(): Promise<void> {
  await resetAllDataServer();
  invalidateReposCache();
  await hydrateRepos();
}

export function backupSummary(b: Backup) {
  return {
    users: b.users.length,
    unitAkademik: b.unitAkademik.length,
    modul: b.modul.length,
    topik: b.topik.length,
    soal: b.soal.length,
    ujian: b.ujian.length,
    sesi: b.sesi.length,
    token: b.token.length,
    files: b.files?.length ?? 0,
  };
}
