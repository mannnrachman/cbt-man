// Scoring + sesi helpers
import { soalRepo, sesiRepo, ujianRepo } from "./repos";
import type { SesiUjian, Soal, Ujian, User } from "./types";
import { uid } from "./storage";
import { gradeAnswers } from "./scoring";
import { PesertaNotAssignedToExamError, isParticipantAssignedToExam } from "./access";

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildSesi(ujian: Ujian, pesertaId: string, user?: User | null): SesiUjian {
  // Defense-in-depth: the pre-exam route already checks group assignment
  // before reaching this point, but `buildSesi` is also reachable through
  // `mutateEntity` / stale client state. Re-assert here so the policy is
  // enforced at the session-builder boundary, not just the UI.
  if (user && !isParticipantAssignedToExam(user, ujian)) {
    throw new PesertaNotAssignedToExamError("Peserta tidak terdaftar pada ujian ini.", {
      ujianId: ujian.id,
      pesertaId,
    });
  }
  const all = soalRepo.all();
  const soalTerpilih: Soal[] = [];
  for (const ts of ujian.topicSets) {
    let pool = all.filter((s) => s.topikId === ts.topikId);
    if (ts.tipe) pool = pool.filter((s) => s.tipe === ts.tipe);
    if (ts.kesulitan) pool = pool.filter((s) => s.kesulitan === ts.kesulitan);
    const chosen = (ts.acakSoal ? shuffle(pool) : pool).slice(0, ts.jumlah);
    if (chosen.length < ts.jumlah) {
      throw new Error(`Bank soal untuk topik terkait ujian "${ujian.nama}" belum cukup.`);
    }
    soalTerpilih.push(...chosen);
  }

  if (soalTerpilih.length === 0) {
    throw new Error(
      `Bank soal untuk ujian "${ujian.nama}" belum cukup atau tidak cocok dengan filter topik.`,
    );
  }

  const jawabanOrder: Record<string, string[]> = {};
  for (const s of soalTerpilih) {
    const ids = s.jawaban.map((j) => j.id);
    jawabanOrder[s.id] = ujian.topicSets.find((ts) => ts.topikId === s.topikId)?.acakJawaban
      ? shuffle(ids)
      : ids;
  }

  return {
    id: uid("se_"),
    ujianId: ujian.id,
    pesertaId,
    status: "belum",
    soalIds: soalTerpilih.map((s) => s.id),
    jawabanOrder,
    jawaban: soalTerpilih.map((s) => ({
      soalId: s.id,
      jawabanIds: [],
      jawabanEssay: "",
      ragu: false,
    })),
    pelanggaran: 0,
    createdAt: Date.now(),
  };
}

export function startSesi(sesi: SesiUjian, ujian: Ujian): SesiUjian {
  const now = Date.now();
  const updated: SesiUjian = {
    ...sesi,
    status: "sedang",
    mulaiAt: now,
    endsAt: now + ujian.durasiMenit * 60_000,
  };
  sesiRepo.upsert(updated);
  return updated;
}

// Auto-grade for objective questions. Essay diisi 0 (perlu manual grading).
export function gradeSesi(sesi: SesiUjian, ujian: Ujian): SesiUjian {
  let total = 0;
  let maxSkor = 0;
  const jawabanGraded = sesi.jawaban.map((j) => {
    const soal = soalRepo.byId(j.soalId);
    if (!soal) return j;
    maxSkor += ujian.poinBenar;
    if (soal.tipe === "essay") {
      // tunda penilaian
      return { ...j, skor: j.skor ?? undefined };
    }
    const benarIds = soal.jawaban.filter((x) => x.benar).map((x) => x.id);
    const selected = j.jawabanIds;
    let skor = 0;
    if (selected.length === 0) skor = ujian.poinKosong;
    else if (benarIds.length === selected.length && benarIds.every((id) => selected.includes(id)))
      skor = ujian.poinBenar;
    else skor = ujian.poinSalah;
    total += skor;
    return { ...j, skor };
  });

  // tambahkan skor essay yang sudah dinilai (jika ada)
  for (const j of jawabanGraded) {
    const soal = soalRepo.byId(j.soalId);
    if (soal?.tipe === "essay" && typeof j.skor === "number") total += j.skor;
  }

  return {
    ...sesi,
    status: "selesai",
    selesaiAt: sesi.selesaiAt ?? Date.now(),
    jawaban: jawabanGraded,
    skorTotal: total,
    maxSkor,
  };
}

// Recompute total skor dari jawaban[].skor (dipakai setelah manual grading)
export function recomputeSkor(sesi: SesiUjian, ujian: Ujian): SesiUjian {
  const total = sesi.jawaban.reduce((a, j) => a + (j.skor ?? 0), 0);
  const maxSkor = sesi.jawaban.length * ujian.poinBenar;
  return { ...sesi, skorTotal: total, maxSkor };
}

export function findOrCreateSesi(
  ujianId: string,
  pesertaId: string,
  user?: User | null,
): SesiUjian {
  const all = sesiRepo.all();
  const existing = all.find(
    (s) => s.ujianId === ujianId && s.pesertaId === pesertaId && s.status !== "selesai",
  );
  if (existing) return existing;
  const ujian = ujianRepo.byId(ujianId);
  if (!ujian) {
    throw new Error("Ujian tidak ditemukan.");
  }
  // Enforce group assignment before any sesi is created. We check here
  // (and not just inside `buildSesi`) so the same predicate covers the
  // "ujian exists" branch too — there is no point producing a sesi for
  // an unassigned participant.
  if (user && !isParticipantAssignedToExam(user, ujian)) {
    throw new PesertaNotAssignedToExamError("Peserta tidak terdaftar pada ujian ini.", {
      ujianId: ujian.id,
      pesertaId,
    });
  }
  const fresh = buildSesi(ujian, pesertaId, user);
  sesiRepo.upsert(fresh);
  return fresh;
}
