-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nama" TEXT NOT NULL,
    "keterangan" TEXT NOT NULL DEFAULT ''
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "namaLengkap" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "allowedTopikIds" TEXT NOT NULL DEFAULT '[]',
    "groupId" TEXT,
    "detail" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" BIGINT NOT NULL,
    CONSTRAINT "User_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Modul" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nama" TEXT NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Topik" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "modulId" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    CONSTRAINT "Topik_modulId_fkey" FOREIGN KEY ("modulId") REFERENCES "Modul" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Soal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "topikId" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "tipe" TEXT NOT NULL,
    "kesulitan" TEXT NOT NULL,
    "audioFileId" TEXT,
    "audioPlayOnce" BOOLEAN NOT NULL DEFAULT false,
    "pembahasan" TEXT NOT NULL DEFAULT '',
    "createdAt" BIGINT NOT NULL,
    CONSTRAINT "Soal_topikId_fkey" FOREIGN KEY ("topikId") REFERENCES "Topik" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Jawaban" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "soalId" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "benar" BOOLEAN NOT NULL,
    CONSTRAINT "Jawaban_soalId_fkey" FOREIGN KEY ("soalId") REFERENCES "Soal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Ujian" (
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
    "createdBy" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL,
    CONSTRAINT "Ujian_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TokenUjian" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ujianId" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "dipakaiOleh" TEXT,
    "dipakaiAt" BIGINT,
    CONSTRAINT "TokenUjian_ujianId_fkey" FOREIGN KEY ("ujianId") REFERENCES "Ujian" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SesiUjian" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ujianId" TEXT NOT NULL,
    "pesertaId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "mulaiAt" BIGINT,
    "selesaiAt" BIGINT,
    "endsAt" BIGINT,
    "soalIds" TEXT NOT NULL DEFAULT '[]',
    "jawabanOrder" TEXT NOT NULL DEFAULT '{}',
    "jawaban" TEXT NOT NULL DEFAULT '[]',
    "pelanggaran" INTEGER NOT NULL DEFAULT 0,
    "skorTotal" REAL,
    "maxSkor" REAL,
    "gradedAt" BIGINT,
    "gradedBy" TEXT,
    "createdAt" BIGINT NOT NULL,
    CONSTRAINT "SesiUjian_ujianId_fkey" FOREIGN KEY ("ujianId") REFERENCES "Ujian" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SesiUjian_pesertaId_fkey" FOREIGN KEY ("pesertaId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppConfig" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'app',
    "appName" TEXT NOT NULL DEFAULT 'CBT-MAN',
    "appDeskripsi" TEXT NOT NULL DEFAULT 'Aplikasi ujian berbasis komputer',
    "pesanLogin" TEXT NOT NULL DEFAULT 'Selamat datang di aplikasi ujian online',
    "mobileLock" BOOLEAN NOT NULL DEFAULT false,
    "multiDevice" BOOLEAN NOT NULL DEFAULT false,
    "roleAccess" TEXT NOT NULL DEFAULT '{}'
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
