-- AlterTable
ALTER TABLE "Ujian" ADD COLUMN "mataKuliahId" TEXT;
ALTER TABLE "Ujian" ADD COLUMN "semesterId" TEXT;

-- CreateTable
CREATE TABLE "Fakultas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nama" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Jurusan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nama" TEXT NOT NULL,
    "fakultasId" TEXT NOT NULL,
    CONSTRAINT "Jurusan_fakultasId_fkey" FOREIGN KEY ("fakultasId") REFERENCES "Fakultas" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProgramStudi" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nama" TEXT NOT NULL,
    "jurusanId" TEXT NOT NULL,
    CONSTRAINT "ProgramStudi_jurusanId_fkey" FOREIGN KEY ("jurusanId") REFERENCES "Jurusan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TahunAkademik" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nama" TEXT NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "Semester" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nama" TEXT NOT NULL,
    "tahunAkademikId" TEXT NOT NULL,
    CONSTRAINT "Semester_tahunAkademikId_fkey" FOREIGN KEY ("tahunAkademikId") REFERENCES "TahunAkademik" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MataKuliah" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kode" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "sks" INTEGER NOT NULL DEFAULT 2,
    "prodiId" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    CONSTRAINT "MataKuliah_prodiId_fkey" FOREIGN KEY ("prodiId") REFERENCES "ProgramStudi" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MataKuliah_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Group" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nama" TEXT NOT NULL,
    "keterangan" TEXT NOT NULL DEFAULT '',
    "prodiId" TEXT,
    CONSTRAINT "Group_prodiId_fkey" FOREIGN KEY ("prodiId") REFERENCES "ProgramStudi" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Group" ("id", "keterangan", "nama") SELECT "id", "keterangan", "nama" FROM "Group";
DROP TABLE "Group";
ALTER TABLE "new_Group" RENAME TO "Group";
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "namaLengkap" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "allowedTopikIds" TEXT NOT NULL DEFAULT '[]',
    "groupId" TEXT,
    "prodiId" TEXT,
    "mataKuliahIds" TEXT NOT NULL DEFAULT '[]',
    "detail" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" BIGINT NOT NULL,
    CONSTRAINT "User_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_prodiId_fkey" FOREIGN KEY ("prodiId") REFERENCES "ProgramStudi" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("aktif", "allowedTopikIds", "createdAt", "detail", "groupId", "id", "namaLengkap", "passwordHash", "role", "username") SELECT "aktif", "allowedTopikIds", "createdAt", "detail", "groupId", "id", "namaLengkap", "passwordHash", "role", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
