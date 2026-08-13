/*
  Warnings:

  - You are about to drop the `UnitAkademik` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `unitId` on the `MataKuliah` table. All the data in the column will be lost.
  - You are about to drop the column `mataKuliahId` on the `Modul` table. All the data in the column will be lost.
  - You are about to drop the column `mataKuliahIds` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `unitId` on the `User` table. All the data in the column will be lost.

*/
-- Disable FK checks for safe dropping later
PRAGMA foreign_keys=off;

-- CreateTable
CREATE TABLE "Fakultas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nama" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "ProgramStudi" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nama" TEXT NOT NULL,
    "fakultasId" TEXT NOT NULL,
    CONSTRAINT "ProgramStudi_fakultasId_fkey" FOREIGN KEY ("fakultasId") REFERENCES "Fakultas" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Rombel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nama" TEXT NOT NULL,
    "programStudiId" TEXT NOT NULL,
    "tahunAkademikId" TEXT NOT NULL,
    CONSTRAINT "Rombel_programStudiId_fkey" FOREIGN KEY ("programStudiId") REFERENCES "ProgramStudi" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Rombel_tahunAkademikId_fkey" FOREIGN KEY ("tahunAkademikId") REFERENCES "TahunAkademik" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserMataKuliah" (
    "userId" TEXT NOT NULL,
    "mataKuliahId" TEXT NOT NULL,

    PRIMARY KEY ("userId", "mataKuliahId"),
    CONSTRAINT "UserMataKuliah_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserMataKuliah_mataKuliahId_fkey" FOREIGN KEY ("mataKuliahId") REFERENCES "MataKuliah" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ModulMataKuliah" (
    "modulId" TEXT NOT NULL,
    "mataKuliahId" TEXT NOT NULL,

    PRIMARY KEY ("modulId", "mataKuliahId"),
    CONSTRAINT "ModulMataKuliah_modulId_fkey" FOREIGN KEY ("modulId") REFERENCES "Modul" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ModulMataKuliah_mataKuliahId_fkey" FOREIGN KEY ("mataKuliahId") REFERENCES "MataKuliah" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- ==========================================
-- BACKFILL DATA PRESERVATION SCRIPT (Preflight)
-- ==========================================
-- 1. Fakultas
INSERT INTO "Fakultas" ("id", "nama")
SELECT "id", "nama" FROM "UnitAkademik" WHERE "tipe" = 'fakultas';

-- 2. ProgramStudi
INSERT INTO "ProgramStudi" ("id", "nama", "fakultasId")
SELECT "id", "nama", COALESCE("parentId", '') FROM "UnitAkademik" WHERE "tipe" = 'prodi' OR "tipe" = 'jurusan';

-- 3. Rombel
-- Note: Assuming default tahunAkademikId if missing.
INSERT INTO "Rombel" ("id", "nama", "programStudiId", "tahunAkademikId")
SELECT "id", "nama", COALESCE("parentId", ''), 'ta_default' FROM "UnitAkademik" WHERE "tipe" = 'kelas';

-- We cannot backfill JSON strings (mataKuliahIds) to Pivot tables purely in SQLite safely without JSON1 extension guarantees, 
-- but we backfill what we can via seed scripts.

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MataKuliah" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kode" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "sks" INTEGER NOT NULL DEFAULT 2,
    "programStudiId" TEXT,
    "semesterId" TEXT,
    CONSTRAINT "MataKuliah_programStudiId_fkey" FOREIGN KEY ("programStudiId") REFERENCES "ProgramStudi" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MataKuliah_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MataKuliah" ("id", "kode", "nama", "semesterId", "sks") SELECT "id", "kode", "nama", "semesterId", "sks" FROM "MataKuliah";
DROP TABLE "MataKuliah";
ALTER TABLE "new_MataKuliah" RENAME TO "MataKuliah";
CREATE TABLE "new_Modul" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nama" TEXT NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO "new_Modul" ("aktif", "id", "nama") SELECT "aktif", "id", "nama" FROM "Modul";
DROP TABLE "Modul";
ALTER TABLE "new_Modul" RENAME TO "Modul";
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "namaLengkap" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "allowedTopikIds" TEXT NOT NULL DEFAULT '[]',
    "rombelId" TEXT,
    "detail" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" BIGINT NOT NULL,
    CONSTRAINT "User_rombelId_fkey" FOREIGN KEY ("rombelId") REFERENCES "Rombel" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("aktif", "allowedTopikIds", "createdAt", "detail", "id", "namaLengkap", "passwordHash", "role", "username") SELECT "aktif", "allowedTopikIds", "createdAt", "detail", "id", "namaLengkap", "passwordHash", "role", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- Now safe to drop UnitAkademik
DROP TABLE "UnitAkademik";

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
