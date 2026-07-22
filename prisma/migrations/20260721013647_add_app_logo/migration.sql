/*
  Warnings:

  - You are about to drop the `Fakultas` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Group` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Jurusan` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProgramStudi` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `prodiId` on the `MataKuliah` table. All the data in the column will be lost.
  - You are about to drop the column `groupId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `prodiId` on the `User` table. All the data in the column will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Fakultas";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Group";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Jurusan";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ProgramStudi";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "UnitAkademik" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nama" TEXT NOT NULL,
    "tipe" TEXT NOT NULL,
    "parentId" TEXT,
    CONSTRAINT "UnitAkademik_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "UnitAkademik" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AppConfig" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'app',
    "appName" TEXT NOT NULL DEFAULT 'CBT-Kampus',
    "appLogo" TEXT NOT NULL DEFAULT '',
    "appDeskripsi" TEXT NOT NULL DEFAULT 'Aplikasi ujian berbasis komputer',
    "pesanLogin" TEXT NOT NULL DEFAULT 'Selamat datang di aplikasi ujian online',
    "mobileLock" BOOLEAN NOT NULL DEFAULT false,
    "multiDevice" BOOLEAN NOT NULL DEFAULT false,
    "roleAccess" TEXT NOT NULL DEFAULT '{}'
);
INSERT INTO "new_AppConfig" ("appDeskripsi", "appName", "id", "mobileLock", "multiDevice", "pesanLogin", "roleAccess") SELECT "appDeskripsi", "appName", "id", "mobileLock", "multiDevice", "pesanLogin", "roleAccess" FROM "AppConfig";
DROP TABLE "AppConfig";
ALTER TABLE "new_AppConfig" RENAME TO "AppConfig";
CREATE TABLE "new_MataKuliah" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kode" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "sks" INTEGER NOT NULL DEFAULT 2,
    "unitId" TEXT,
    "semesterId" TEXT,
    CONSTRAINT "MataKuliah_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "UnitAkademik" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MataKuliah_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MataKuliah" ("id", "kode", "nama", "semesterId", "sks") SELECT "id", "kode", "nama", "semesterId", "sks" FROM "MataKuliah";
DROP TABLE "MataKuliah";
ALTER TABLE "new_MataKuliah" RENAME TO "MataKuliah";
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "namaLengkap" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "allowedTopikIds" TEXT NOT NULL DEFAULT '[]',
    "unitId" TEXT,
    "mataKuliahIds" TEXT NOT NULL DEFAULT '[]',
    "detail" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" BIGINT NOT NULL,
    CONSTRAINT "User_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "UnitAkademik" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("aktif", "allowedTopikIds", "createdAt", "detail", "id", "mataKuliahIds", "namaLengkap", "passwordHash", "role", "username") SELECT "aktif", "allowedTopikIds", "createdAt", "detail", "id", "mataKuliahIds", "namaLengkap", "passwordHash", "role", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
