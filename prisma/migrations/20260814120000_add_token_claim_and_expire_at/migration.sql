-- AlterTable
ALTER TABLE "TokenUjian" ADD COLUMN "expireAt" BIGINT;

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

-- CreateIndex
CREATE INDEX "TokenClaim_ujianId_idx" ON "TokenClaim"("ujianId");

-- CreateIndex
CREATE UNIQUE INDEX "TokenClaim_ujianId_pesertaId_key" ON "TokenClaim"("ujianId", "pesertaId");
