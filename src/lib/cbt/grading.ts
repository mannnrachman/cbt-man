import { soalRepo } from "./repos";
import { gradeAnswers } from "./scoring";
import type { SesiUjian, Ujian } from "./types";

export function gradeSesi(sesi: SesiUjian, ujian: Ujian): SesiUjian {
  const soalById = new Map(soalRepo.all().map((s) => [s.id, s]));
  const { jawaban, skorTotal, maxSkor } = gradeAnswers(ujian, soalById, sesi.jawaban);
  return {
    ...sesi,
    status: "selesai",
    selesaiAt: sesi.selesaiAt ?? Date.now(),
    jawaban,
    skorTotal,
    maxSkor,
  };
}
