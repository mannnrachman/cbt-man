import type { SesiUjian, Soal, Ujian } from "./types";

export interface GradeOutcome {
  jawaban: SesiUjian["jawaban"];
  skorTotal: number;
  maxSkor: number;
}

/**
 * Authoritative auto-grading for a participant's answer list.
 *
 * Objective questions (pg/multi/bs):
 * - empty selection -> `ujian.poinKosong`
 * - exact match     -> `ujian.poinBenar`
 * - anything else   -> `ujian.poinSalah`
 *
 * Essay answers are NOT auto-graded: the existing `skor` is preserved
 * (`undefined` = "belum dinilai", to be filled by the evaluator).
 *
 * `maxSkor` counts every question at `ujian.poinBenar` (essays included)
 * so percentages stay comparable across the whole exam.
 *
 * This is the single source of truth for scoring. It is intentionally
 * pure (no DB / repo access) so the client submit path, the server-side
 * authoritative grading, and the unit tests all share the same rules.
 */
export function gradeAnswers(
  ujian: Pick<Ujian, "poinBenar" | "poinSalah" | "poinKosong">,
  soalById: ReadonlyMap<string, Soal>,
  jawaban: SesiUjian["jawaban"],
): GradeOutcome {
  let total = 0;
  let maxSkor = 0;
  const jawabanGraded = (jawaban || []).map((j) => {
    const soal = soalById.get(j.soalId);
    if (!soal) return j;
    maxSkor += ujian.poinBenar;
    if (soal.tipe === "essay") {
      // Tunda penilaian essay sampai evaluator memberi skor
      return { ...j, skor: j.skor ?? undefined };
    }
    const benarIds = soal.jawaban.filter((x) => x.benar).map((x) => x.id);
    const selected = j.jawabanIds || [];
    let skor = 0;
    if (selected.length === 0) {
      skor = ujian.poinKosong;
    } else if (benarIds.length === selected.length && benarIds.every((id) => selected.includes(id))) {
      skor = ujian.poinBenar;
    } else {
      skor = ujian.poinSalah;
    }
    total += skor;
    return { ...j, skor };
  });

  // Tambahkan skor essay yang sudah dinilai (jika ada)
  for (const j of jawabanGraded) {
    const soal = soalById.get(j.soalId);
    if (soal?.tipe === "essay" && typeof j.skor === "number") {
      total += j.skor;
    }
  }

  return { jawaban: jawabanGraded, skorTotal: total, maxSkor };
}
