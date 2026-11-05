import { PrismaClient } from "@prisma/client";
import { createLivePreviewExam } from "../src/lib/server/db/seed-shared.mjs";

if (process.env.NODE_ENV === "production") {
  throw new Error("Penyiapan live preview hanya untuk database development/demo lokal.");
}
const prisma = new PrismaClient();
try {
  await prisma.$transaction(async (tx) => {
    const admin = await tx.user.findFirst({ where: { role: "super_admin", aktif: true } });
    if (!admin) throw new Error("Admin aktif tidak ditemukan.");
    const soal = await tx.soal.findMany({ orderBy: [{ topikId: "asc" }, { id: "asc" }] });
    const participants = await tx.user.findMany({ where: { role: "mahasiswa", aktif: true }, select: { unitId: true } });
    const groupIds = [...new Set(participants.map((u) => u.unitId).filter(Boolean))];
    const exam = createLivePreviewExam({ soal, groupIds, createdBy: admin.id });
    const data = { ...exam, groupIds: JSON.stringify(exam.groupIds), topicSets: JSON.stringify(exam.topicSets), createdAt: BigInt(exam.createdAt) };
    const { id, createdAt, createdBy, ...update } = data;
    await tx.ujian.upsert({ where: { id }, create: data, update: { ...update, beginAt: null, endAt: null, mataKuliahId: null, semesterId: null, penawaranId: null } });
    console.log(`Demo siap: ${soal.length} soal, ${exam.topicSets.length} topik, ${groupIds.length} unit peserta. Sesi dan jawaban lama dipertahankan.`);
  });
} finally {
  await prisma.$disconnect();
}
