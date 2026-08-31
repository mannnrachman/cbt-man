import { PrismaClient } from "@prisma/client";
import { parseJsonArray } from "./domain-json.mjs";

const prisma = new PrismaClient();

function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function add(findings, severity, category, message, ids = []) {
  findings.push({ severity, category, message, ids });
}

try {
  let modules;
  let topics;
  let exams;
  let tokens;
  let claims;
  try {
    [modules, topics, exams, tokens, claims] = await Promise.all([
      prisma.modul.findMany({ select: { id: true, nama: true, mataKuliahId: true } }),
      prisma.topik.findMany({ include: { modul: { select: { id: true, nama: true, mataKuliahId: true } } } }),
      prisma.ujian.findMany({ select: { id: true, nama: true, mataKuliahId: true, topicSets: true, groupIds: true, status: true, penawaran: { select: { pesertaIds: true } } } }),
      prisma.tokenUjian.findMany({ select: { id: true, ujianId: true, kode: true, dipakaiOleh: true } }),
      prisma.tokenClaim.findMany({ select: { id: true, ujianId: true, pesertaId: true, kode: true } }),
    ]);
  } catch (error) {
    if (error?.code === "P2022") {
      const duplicateRows = await prisma.$queryRawUnsafe(
        'SELECT "ujianId", "pesertaId", COUNT(*) AS "count" FROM "SesiUjian" GROUP BY "ujianId", "pesertaId" HAVING COUNT(*) > 1',
      );
      const findings = duplicateRows.map((row) => ({
        severity: "blocking",
        category: "duplicate_session",
        message: "Ada lebih dari satu sesi untuk peserta dan ujian yang sama; bersihkan sebelum unique migration.",
        ids: [`${row.ujianId}::${row.pesertaId}`],
      }));
      findings.push({
        severity: "review",
        category: "schema_migration_pending",
        message: "Database belum menerapkan seluruh migration; preflight lama hanya memeriksa konflik yang dapat menggagalkan migration.",
        ids: [],
      });
      console.log(JSON.stringify({ readyForDomainMigration: false, counts: null, findings }, null, 2));
      process.exitCode = 1;
      process.exit();
    }
    throw error;
  }

  const findings = [];
  let sessions = [];
  try {
    sessions = await prisma.sesiUjian.findMany({ select: { id: true, ujianId: true, pesertaId: true, soalIds: true, soalSnapshot: true } });
  } catch (error) {
    if (error?.code === "P2022") {
      add(findings, "blocking", "session_snapshot_migration_pending", "Kolom snapshot sesi belum tersedia; terapkan migration lifecycle/snapshot sebelum menjalankan preflight penuh.");
    } else {
      throw error;
    }
  }

  const moduleById = new Map(modules.map((item) => [item.id, item]));
  const topicById = new Map(topics.map((item) => [item.id, item]));
  const claimKeys = new Set(claims.map((item) => `${item.ujianId}::${item.pesertaId}`));

  const orphanModules = modules.filter((item) => !item.mataKuliahId).map((item) => item.id);
  if (orphanModules.length) {
    add(findings, "blocking", "module_without_course", "Modul belum memiliki mata kuliah; backfill Topik.mataKuliahId tidak dapat ditentukan otomatis.", orphanModules);
  }

  const orphanTopics = topics.filter((item) => !moduleById.has(item.modulId)).map((item) => item.id);
  if (orphanTopics.length) {
    add(findings, "blocking", "topic_without_module", "Topik memiliki modul yang tidak ditemukan.", orphanTopics);
  }
  const unownedTopics = topics.filter((item) => !item.mataKuliahId).map((item) => item.id);
  if (unownedTopics.length) {
    add(findings, "blocking", "topic_without_course", "Topik belum memiliki mata kuliah langsung.", unownedTopics);
  }

  for (const exam of exams) {
    const sets = parseJsonArray(exam.topicSets);
    if (!sets) {
      add(findings, "blocking", "invalid_exam_topic_sets", `Paket ${exam.nama} memiliki topicSets yang bukan JSON array valid.`, [exam.id]);
      continue;
    }
    const ids = sets.map((item) => item?.topikId).filter(Boolean);
    const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
    if (duplicateIds.length) add(findings, "blocking", "duplicate_exam_source", `Paket ${exam.nama} memiliki sumber topik duplikat.`, [exam.id, ...duplicateIds]);
    const crossCourse = ids.filter((id) => {
      const topic = topicById.get(id);
      const topicCourseId = topic?.mataKuliahId ?? topic?.modul?.mataKuliahId;
      return exam.mataKuliahId && topicCourseId !== exam.mataKuliahId;
    });
    if (crossCourse.length) add(findings, "blocking", "cross_course_exam_source", `Paket ${exam.nama} mengambil topik dari mata kuliah lain.`, [exam.id, ...crossCourse]);
    if (!exam.mataKuliahId && ids.length) add(findings, "review", "exam_without_course", `Paket ${exam.nama} belum memiliki mata kuliah.`, [exam.id]);
    const assignedPeserta = parseJson(exam.penawaran?.pesertaIds, []);
    if (exam.status === "published" && parseJson(exam.groupIds, []).length === 0 && assignedPeserta.length === 0) add(findings, "blocking", "published_exam_without_assignment", "Paket published " + exam.nama + " tidak memiliki assignment peserta.", [exam.id]);
  }

  const legacySessions = sessions.filter((item) => parseJson(item.soalSnapshot, []).length === 0).map((item) => item.id);
  if (legacySessions.length) add(findings, "review", "legacy_session_without_snapshot", "Sesi historis belum memiliki snapshot soal; pertahankan fallback legacy sebelum migrasi final.", legacySessions);

  const sessionKeys = new Map();
  for (const item of sessions) {
    const key = `${item.ujianId}::${item.pesertaId}`;
    sessionKeys.set(key, (sessionKeys.get(key) ?? 0) + 1);
  }
  const duplicateSessions = [...sessionKeys.entries()].filter(([, count]) => count > 1).map(([key]) => key);
  if (duplicateSessions.length) add(findings, "blocking", "duplicate_session", "Ada lebih dari satu sesi untuk peserta dan ujian yang sama; unique constraint belum aman diterapkan.", duplicateSessions);

  const legacyClaims = tokens.filter((item) => item.dipakaiOleh && !claimKeys.has(`${item.ujianId}::${item.dipakaiOleh}`)).map((item) => item.id);
  if (legacyClaims.length) add(findings, "blocking", "legacy_token_without_claim", "Token legacy memiliki pemakai tetapi belum memiliki TokenClaim canonical.", legacyClaims);

  const blocking = findings.filter((item) => item.severity === "blocking");
  const report = {
    readyForDomainMigration: blocking.length === 0,
    counts: { modules: modules.length, topics: topics.length, exams: exams.length, sessions: sessions.length, tokens: tokens.length, claims: claims.length },
    findings,
  };
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = blocking.length ? 1 : 0;
} finally {
  await prisma.$disconnect();
}
