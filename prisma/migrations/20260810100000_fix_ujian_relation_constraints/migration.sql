-- The prior UnitAkademik migration created Ujian.mataKuliahId and
-- Ujian.semesterId without the relations declared in prisma/schema.prisma.
-- Rebuild only Ujian, preserving every existing column and row, then add the
-- missing SET NULL foreign keys required by the current schema.
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
    "mataKuliahId" TEXT,
    "semesterId" TEXT,
    "topicSets" TEXT NOT NULL DEFAULT '[]',
    "showResult" BOOLEAN NOT NULL DEFAULT true,
    "showResultDetail" BOOLEAN NOT NULL DEFAULT false,
    "fullscreenWajib" BOOLEAN NOT NULL DEFAULT true,
    "maxPindahTab" INTEGER NOT NULL DEFAULT 3,
    "blokirShortcut" BOOLEAN NOT NULL DEFAULT true,
    "mode" TEXT NOT NULL DEFAULT 'online',
    "allowCalculator" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL,
    CONSTRAINT "Ujian_mataKuliahId_fkey" FOREIGN KEY ("mataKuliahId") REFERENCES "MataKuliah" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Ujian_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Ujian_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Normalize dangling optional relation IDs intentionally. Use the normal database
-- backup/recovery procedure before deploy; this forward normalization rolls back
-- at deployment level (restore the backup or revert the release), not in SQL.
INSERT INTO "new_Ujian" ("allowCalculator", "beginAt", "blokirShortcut", "createdAt", "createdBy", "deskripsi", "durasiMenit", "endAt", "fullscreenWajib", "groupIds", "id", "ipRange", "mataKuliahId", "maxPindahTab", "mode", "nama", "poinBenar", "poinKosong", "poinSalah", "semesterId", "showResult", "showResultDetail", "tokenAktif", "topicSets") SELECT "allowCalculator", "beginAt", "blokirShortcut", "createdAt", "createdBy", "deskripsi", "durasiMenit", "endAt", "fullscreenWajib", "groupIds", "id", "ipRange", CASE WHEN "mataKuliahId" IS NULL THEN NULL WHEN EXISTS (SELECT 1 FROM "MataKuliah" WHERE "MataKuliah"."id" = "Ujian"."mataKuliahId") THEN "mataKuliahId" ELSE NULL END, "maxPindahTab", "mode", "nama", "poinBenar", "poinKosong", "poinSalah", CASE WHEN "semesterId" IS NULL THEN NULL WHEN EXISTS (SELECT 1 FROM "Semester" WHERE "Semester"."id" = "Ujian"."semesterId") THEN "semesterId" ELSE NULL END, "showResult", "showResultDetail", "tokenAktif", "topicSets" FROM "Ujian";

DROP TABLE "Ujian";
ALTER TABLE "new_Ujian" RENAME TO "Ujian";

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
