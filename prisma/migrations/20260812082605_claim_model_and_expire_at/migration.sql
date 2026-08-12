/*
  Warnings:

  - You are about to drop the column `dipakaiAt` on the `TokenUjian` table. All the data in the column will be lost.
  - You are about to drop the column `dipakaiOleh` on the `TokenUjian` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "TokenClaim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ujianId" TEXT NOT NULL,
    "pesertaId" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "claimedAt" BIGINT NOT NULL,
    CONSTRAINT "TokenClaim_ujianId_fkey" FOREIGN KEY ("ujianId") REFERENCES "Ujian" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TokenClaim_pesertaId_fkey" FOREIGN KEY ("pesertaId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TokenUjian" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ujianId" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "expireAt" BIGINT,
    CONSTRAINT "TokenUjian_ujianId_fkey" FOREIGN KEY ("ujianId") REFERENCES "Ujian" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TokenUjian" ("id", "kode", "ujianId") SELECT "id", "kode", "ujianId" FROM "TokenUjian";
DROP TABLE "TokenUjian";
ALTER TABLE "new_TokenUjian" RENAME TO "TokenUjian";
CREATE INDEX "TokenUjian_ujianId_idx" ON "TokenUjian"("ujianId");
CREATE UNIQUE INDEX "TokenUjian_ujianId_kode_key" ON "TokenUjian"("ujianId", "kode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "TokenClaim_ujianId_pesertaId_key" ON "TokenClaim"("ujianId", "pesertaId");
