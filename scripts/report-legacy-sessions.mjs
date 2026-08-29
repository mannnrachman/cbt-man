import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function parseJson(value, fallback) {
  try {
    const parsed = JSON.parse(value ?? "");
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

try {
  const sessions = await prisma.sesiUjian.findMany({
    where: { soalSnapshot: "[]" },
    select: {
      id: true, ujianId: true, pesertaId: true, status: true,
      mulaiAt: true, selesaiAt: true, soalIds: true, jawaban: true,
      skorTotal: true, maxSkor: true, createdAt: true,
      ujian: { select: { nama: true, status: true } },
      peserta: { select: { namaLengkap: true, username: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const result = sessions.map((session) => {
    const questionIds = parseJson(session.soalIds, []);
    const answers = parseJson(session.jawaban, []);
    const finished = Boolean(session.selesaiAt) || session.status === "selesai";
    return {
      id: session.id,
      ujianId: session.ujianId,
      ujian: session.ujian,
      pesertaId: session.pesertaId,
      peserta: session.peserta,
      status: session.status,
      state: finished ? "historical-finished" : "active-legacy",
      questionCount: Array.isArray(questionIds) ? questionIds.length : 0,
      answerCount: Array.isArray(answers) ? answers.length : 0,
      hasScore: session.skorTotal !== null,
      maxSkor: session.maxSkor,
      createdAt: session.createdAt,
      decision: "preserve-legacy",
    };
  });

  console.log(JSON.stringify({
    readOnly: true,
    count: result.length,
    sessions: result,
    recommendation: result.length
      ? "Pertahankan fallback legacy dan jangan backfill snapshot tanpa sumber soal yang tervalidasi."
      : "Tidak ada sesi legacy tanpa snapshot.",
  }, (_, value) => typeof value === "bigint" ? value.toString() : value, 2));
} finally {
  await prisma.$disconnect();
}
