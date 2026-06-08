import { PrismaClient } from "@prisma/client";
import { webcrypto } from "node:crypto";

const cryptoApi = globalThis.crypto ?? webcrypto;
const prisma = new PrismaClient();

function uid(prefix = "") {
  return prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function b64(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

async function hashPassword(password) {
  const salt = cryptoApi.getRandomValues(new Uint8Array(16));
  const key = await cryptoApi.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const hash = await cryptoApi.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, key, 256);
  return `pbkdf2$100000$${b64(salt)}$${b64(hash)}`;
}

async function main() {
  if (await prisma.user.count()) return;
  const now = Date.now();
  const gA = { id: uid("g_"), nama: "XII IPA 1", keterangan: "Kelas 12 IPA 1" };
  const gB = { id: uid("g_"), nama: "XII IPA 2", keterangan: "Kelas 12 IPA 2" };
  await prisma.group.createMany({ data: [gA, gB] });

  const adminId = uid("u_");
  const operatorId = uid("u_");
  await prisma.user.createMany({
    data: [
      { id: adminId, username: "admin", passwordHash: await hashPassword("admin123"), namaLengkap: "Administrator", role: "admin", allowedTopikIds: "[]", aktif: true, createdAt: BigInt(now) },
      { id: operatorId, username: "guru", passwordHash: await hashPassword("guru123"), namaLengkap: "Budi Santoso, S.Pd", role: "operator", allowedTopikIds: "[]", aktif: true, createdAt: BigInt(now) },
      ...(await Promise.all([
        ["siswa1", "Ahmad Fadli", gA.id],
        ["siswa2", "Siti Nurhaliza", gA.id],
        ["siswa3", "Rudi Hartono", gA.id],
        ["siswa4", "Dewi Lestari", gB.id],
        ["siswa5", "Eko Prasetyo", gB.id],
      ].map(async ([username, namaLengkap, groupId]) => ({ id: uid("u_"), username, passwordHash: await hashPassword(`${username}123`), namaLengkap, role: "peserta", allowedTopikIds: "[]", groupId, aktif: true, createdAt: BigInt(now) }))))
    ],
  });

  const mMat = { id: uid("m_"), nama: "Matematika", aktif: true };
  const mIpa = { id: uid("m_"), nama: "IPA Terpadu", aktif: true };
  await prisma.modul.createMany({ data: [mMat, mIpa] });
  const topiks = [
    { id: uid("t_"), modulId: mMat.id, nama: "Aljabar" },
    { id: uid("t_"), modulId: mMat.id, nama: "Geometri" },
    { id: uid("t_"), modulId: mIpa.id, nama: "Fisika Dasar" },
    { id: uid("t_"), modulId: mIpa.id, nama: "Biologi Dasar" },
  ];
  await prisma.topik.createMany({ data: topiks });

  const soalDefs = [
    [topiks[0].id, "Hasil dari 2x + 3 = 11 adalah x = ?", ["2", "3", "4", "5"], 2, "mudah"],
    [topiks[0].id, "Akar dari persamaan x² - 5x + 6 = 0 adalah?", ["1 dan 6", "2 dan 3", "-2 dan -3", "1 dan 5"], 1, "sedang"],
    [topiks[1].id, "Luas segitiga alas 10 cm tinggi 6 cm adalah?", ["30 cm²", "60 cm²", "16 cm²", "20 cm²"], 0, "mudah"],
    [topiks[1].id, "Volume kubus dengan rusuk 5 cm adalah?", ["25 cm³", "75 cm³", "125 cm³", "250 cm³"], 2, "mudah"],
    [topiks[2].id, "Satuan SI untuk gaya adalah?", ["Joule", "Newton", "Watt", "Pascal"], 1, "mudah"],
    [topiks[3].id, "Organel sel yang berfungsi sebagai pembangkit energi adalah?", ["Ribosom", "Mitokondria", "Lisosom", "Vakuola"], 1, "mudah"],
  ];
  for (const [topikId, detail, opsi, benarIdx, kesulitan] of soalDefs) {
    await prisma.soal.create({
      data: {
        id: uid("s_"),
        topikId,
        detail,
        tipe: "pg",
        kesulitan,
        pembahasan: "",
        createdAt: BigInt(now),
        jawaban: { create: opsi.map((opt, idx) => ({ id: uid("j_"), detail: opt, benar: idx === benarIdx })) },
      },
    });
  }

  await prisma.ujian.create({
    data: {
      id: uid("ex_"),
      nama: "Ujian Tengah Semester — Matematika",
      deskripsi: "<p>Kerjakan dengan jujur. Durasi 30 menit.</p>",
      durasiMenit: 30,
      poinBenar: 10,
      poinSalah: 0,
      poinKosong: 0,
      tokenAktif: false,
      ipRange: "",
      groupIds: JSON.stringify([gA.id, gB.id]),
      topicSets: JSON.stringify([
        { id: uid("ts_"), topikId: topiks[0].id, jumlah: 2, jumlahOpsi: 4, acakSoal: true, acakJawaban: true },
        { id: uid("ts_"), topikId: topiks[1].id, jumlah: 2, jumlahOpsi: 4, acakSoal: true, acakJawaban: true },
      ]),
      showResult: true,
      showResultDetail: true,
      fullscreenWajib: true,
      maxPindahTab: 3,
      blokirShortcut: true,
      createdBy: adminId,
      createdAt: BigInt(now),
    },
  });

  await prisma.appConfig.create({
    data: {
      id: "app",
      appName: "CBT-MAN",
      appDeskripsi: "Aplikasi ujian berbasis komputer",
      pesanLogin: "Selamat datang di aplikasi ujian online",
      mobileLock: false,
      multiDevice: false,
      roleAccess: JSON.stringify({ operator: ["dashboard", "peserta", "modul", "files", "ujian", "hasil", "evaluasi", "laporan", "leaderboard"] }),
    },
  });
}

main().finally(async () => {
  await prisma.$disconnect();
});
