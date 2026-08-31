/* eslint-disable @typescript-eslint/no-explicit-any */
// Backup / restore snapshot CBT berbasis database server.
import { z } from "zod";
import { toast } from "sonner";
import {
  usersRepo,
  unitAkademikRepo,
  mataKuliahRepo,
  penawaranRepo,
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
  MataKuliahSchema,
  PenawaranMataKuliahSchema,
  ModulSchema,
  TopikSchema,
  SoalSchema,
  UjianSchema,
  TokenUjianSchema,
  TokenClaimSchema,
  SesiUjianSchema,
  ConfigSchema,
} from "./types";
import { exportTokenClaimsServer, importBackupServer, resetAllDataServer } from "@/lib/server/backup/functions";
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
  mataKuliah: z.array(MataKuliahSchema).default([]),
  penawaran: z.array(PenawaranMataKuliahSchema).default([]),
  modul: z.array(ModulSchema),
  topik: z.array(TopikSchema),
  soal: z.array(SoalSchema),
  ujian: z.array(UjianSchema),
  token: z.array(TokenUjianSchema),
  tokenClaims: z.array(TokenClaimSchema).default([]),
  sesi: z.array(SesiUjianSchema),
  config: ConfigSchema,
  files: z.array(FileBackupSchema).optional(),
});
export type Backup = z.infer<typeof BackupSchema>;

export async function exportBackup(): Promise<Backup> {
  const files = await exportFilesServer();
  const tokenClaims = await exportTokenClaimsServer();
  return {
    app: "cbtman",
    version: 1,
    exportedAt: Date.now(),
    users: usersRepo.all(),
    unitAkademik: unitAkademikRepo.all(),
    mataKuliah: mataKuliahRepo.all(),
    penawaran: penawaranRepo.all(),
    modul: modulRepo.all(),
    topik: topikRepo.all(),
    soal: soalRepo.all(),
    ujian: ujianRepo.all(),
    token: tokenRepo.all(),
    tokenClaims: tokenClaims.map((item) => ({ ...item, claimedAt: Number(item.claimedAt) })),
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function importBackup(raw: any): Promise<Backup> {
  if (raw && typeof raw === "object") {
    if ("groups" in raw && Array.isArray(raw.groups)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      raw.unitAkademik = raw.groups.map((g: any) => ({
        id: g.id,
        nama: g.nama,
        tipe: "prodi",
        parentId: null,
      }));
      delete raw.groups;
    }
    if ("users" in raw && Array.isArray(raw.users)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      raw.users = raw.users.map((u: any) => ({
        ...u,
        unitId: u.unitId ?? u.groupId ?? u.prodiId ?? null,
      }));
    }
    if ("ujian" in raw && Array.isArray(raw.ujian)) {
      // Backups created before the lifecycle field represent executable exams.
      raw.ujian = raw.ujian.map((u: any) => ({ ...u, status: u.status ?? "published" }));
    }
  }

  const data = BackupSchema.parse(raw);
  await importBackupServer({
    data: {
      users: data.users,
      unitAkademik: data.unitAkademik,
      mataKuliah: data.mataKuliah,
      penawaran: data.penawaran,
      modul: data.modul,
      topik: data.topik,
      soal: data.soal,
      ujian: data.ujian,
      token: data.token,
      tokenClaims: data.tokenClaims,
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
    mataKuliah: b.mataKuliah.length,
    penawaran: b.penawaran.length,
    modul: b.modul.length,
    topik: b.topik.length,
    soal: b.soal.length,
    ujian: b.ujian.length,
    sesi: b.sesi.length,
    token: b.token.length,
    files: b.files?.length ?? 0,
  };
}
