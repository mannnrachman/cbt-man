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
    "allowNilaiNormal" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL,
    CONSTRAINT "Ujian_mataKuliahId_fkey" FOREIGN KEY ("mataKuliahId") REFERENCES "MataKuliah" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Ujian_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Ujian_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Ujian" ("allowCalculator", "beginAt", "blokirShortcut", "createdAt", "createdBy", "deskripsi", "durasiMenit", "endAt", "fullscreenWajib", "groupIds", "id", "ipRange", "mataKuliahId", "maxPindahTab", "mode", "nama", "poinBenar", "poinKosong", "poinSalah", "semesterId", "showResult", "showResultDetail", "tokenAktif", "topicSets") SELECT "allowCalculator", "beginAt", "blokirShortcut", "createdAt", "createdBy", "deskripsi", "durasiMenit", "endAt", "fullscreenWajib", "groupIds", "id", "ipRange", "mataKuliahId", "maxPindahTab", "mode", "nama", "poinBenar", "poinKosong", "poinSalah", "semesterId", "showResult", "showResultDetail", "tokenAktif", "topicSets" FROM "Ujian";
DROP TABLE "Ujian";
ALTER TABLE "new_Ujian" RENAME TO "Ujian";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
