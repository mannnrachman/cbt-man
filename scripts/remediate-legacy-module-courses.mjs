import { PrismaClient } from "@prisma/client";
import { validateExamTopicSets } from "./domain-json.mjs";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

const mappings = [
  { moduleName: "Pemrograman Web", code: "PW1", courseNames: ["Pemrograman Web", "Pemprograman Web"] },
  { moduleName: "Basis Data", code: "BD1", courseNames: ["Basis Data"] },
  { moduleName: "Algoritma", code: "AL1", courseNames: ["Algoritma"] },
];

function normalize(value) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

try {
  const legacyExams = validateExamTopicSets(await prisma.ujian.findMany({
    select: { id: true, nama: true, topicSets: true, mataKuliahId: true, status: true },
  }));

  for (const mapping of mappings) {
    const module = await prisma.modul.findFirst({ where: { nama: mapping.moduleName, mataKuliahId: null } });
    if (!module) {
      console.log(`${mapping.moduleName}: tidak ada modul legacy yang perlu diperbaiki`);
      continue;
    }

    const courses = await prisma.mataKuliah.findMany({ select: { id: true, kode: true, nama: true } });
    let course = courses.find((item) => mapping.courseNames.some((name) => normalize(name) === normalize(item.nama)));
    if (!course) {
      if (!apply) {
        console.log(`${mapping.moduleName}: akan membuat mata kuliah ${mapping.courseNames[0]} (${mapping.code})`);
        continue;
      }
      course = await prisma.mataKuliah.create({
        data: { id: `mk_legacy_${mapping.code.toLowerCase()}`, kode: mapping.code, nama: mapping.courseNames[0], sks: 2 },
        select: { id: true, kode: true, nama: true },
      });
    }

    if (apply) {
      await prisma.modul.update({ where: { id: module.id }, data: { mataKuliahId: course.id } });
    }
    console.log(`${mapping.moduleName}: ${apply ? "ditautkan" : "siap ditautkan"} ke ${course.nama} (${course.id})`);
  }

  for (const exam of legacyExams) {
    const sourceIds = exam.sourceIds;
    const sourceTopics = sourceIds.length
      ? await prisma.topik.findMany({ where: { id: { in: sourceIds } }, include: { modul: true } })
      : [];
    const courseIds = [...new Set(sourceTopics.map((topic) => topic.mataKuliahId ?? topic.modul.mataKuliahId).filter(Boolean))];
    if (courseIds.length !== 1 || sourceTopics.length !== new Set(sourceIds).size) continue;
    const course = await prisma.mataKuliah.findUnique({ where: { id: courseIds[0] }, select: { id: true, nama: true } });
    if (!course) continue;
    if (exam.mataKuliahId !== course.id) {
      if (exam.status !== "draft") {
        console.log(`${exam.nama}: BLOCKED, paket sudah published dan perlu revisi eksplisit`);
        continue;
      }
      if (apply) await prisma.ujian.update({ where: { id: exam.id }, data: { mataKuliahId: course.id } });
      console.log(`${exam.nama}: ${apply ? "dikoreksi" : "siap dikoreksi"} ke ${course.nama} (${course.id}) berdasarkan sumber topik`);
    }
  }
  if (!apply) console.log("Mode dry-run. Jalankan ulang dengan --apply untuk menyimpan pemetaan eksplisit.");
} finally {
  await prisma.$disconnect();
}
