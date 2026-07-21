/*
  Warnings:

  - A unique constraint covering the columns `[ujianId,kode]` on the table `TokenUjian` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Session" ADD COLUMN "deviceFingerprint" TEXT;
ALTER TABLE "Session" ADD COLUMN "userAgent" TEXT;

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "userRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "details" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Ujian" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nama" TEXT NOT NULL,
    "deskripsi" TEXT NOT NULL DEFAULT '',
    "durasiMenit" INTEGER NOT NULL,
    "poinBenar" REAL NOT NULL DEFAULT 1,
    "poinSalah" REAL NOT NULL DEFAULT 0,
    "poinKosong" REAL NOT NULL DEFAULT 0,
    "beginAt" BIGINT,
    "endAt" BIGINT,
    "tokenAktif" BOOLEAN NOT NULL DEFAULT false,
    "ipRange" TEXT NOT NULL DEFAULT '',
    "groupIds" TEXT NOT NULL DEFAULT '[]',
    "topicSets" TEXT NOT NULL DEFAULT '[]',
    "showResult" BOOLEAN NOT NULL DEFAULT true,
    "showResultDetail" BOOLEAN NOT NULL DEFAULT false,
    "fullscreenWajib" BOOLEAN NOT NULL DEFAULT true,
    "maxPindahTab" INTEGER NOT NULL DEFAULT 3,
    "blokirShortcut" BOOLEAN NOT NULL DEFAULT true,
    "mode" TEXT NOT NULL DEFAULT 'online',
    "createdBy" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL,
    CONSTRAINT "Ujian_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Ujian" ("beginAt", "blokirShortcut", "createdAt", "createdBy", "deskripsi", "durasiMenit", "endAt", "fullscreenWajib", "groupIds", "id", "ipRange", "maxPindahTab", "nama", "poinBenar", "poinKosong", "poinSalah", "showResult", "showResultDetail", "tokenAktif", "topicSets") SELECT "beginAt", "blokirShortcut", "createdAt", "createdBy", "deskripsi", "durasiMenit", "endAt", "fullscreenWajib", "groupIds", "id", "ipRange", "maxPindahTab", "nama", "poinBenar", "poinKosong", "poinSalah", "showResult", "showResultDetail", "tokenAktif", "topicSets" FROM "Ujian";
DROP TABLE "Ujian";
ALTER TABLE "new_Ujian" RENAME TO "Ujian";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_idx" ON "AuditLog"("entity");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "TokenUjian_ujianId_idx" ON "TokenUjian"("ujianId");

-- CreateIndex
CREATE UNIQUE INDEX "TokenUjian_ujianId_kode_key" ON "TokenUjian"("ujianId", "kode");
