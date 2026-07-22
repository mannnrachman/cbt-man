import { soalRepo } from "./repos";
import type { SesiUjian, Ujian } from "./types";

export function gradeSesi(sesi: SesiUjian, ujian: Ujian): SesiUjian {
  const currentSesi = JSON.parse(JSON.stringify(sesi)) as SesiUjian;
  let score = 0;
  
  for (let i = 0; i < currentSesi.soalIds.length; i++) {
    const soalId = currentSesi.soalIds[i];
    const soal = soalRepo.byId(soalId);
    const j = currentSesi.jawaban[i];
    if (!soal || !j) continue;

    if (soal.tipe === "multi") {
      const correctIds = soal.jawaban.filter((x) => x.benar).map((x) => x.id);
      const isCorrect =
        j.jawabanIds.length === correctIds.length &&
        j.jawabanIds.every((id) => correctIds.includes(id));
      if (isCorrect) score += ujian.poinBenar;
    } else {
      const correctOpt = soal.jawaban.find((x) => x.benar);
      if (correctOpt && j.jawabanIds.includes(correctOpt.id)) {
        score += ujian.poinBenar;
      }
    }
  }
  
  currentSesi.status = "selesai";
  currentSesi.skorTotal = score;
  currentSesi.selesaiAt = Date.now();
  
  if (currentSesi.mulaiAt) {
    const maxDur = ujian.durasiMenit || 60;
    const start = currentSesi.mulaiAt;
    const now = Date.now();
    const elapsedMinutes = (now - start) / 60000;
    if (elapsedMinutes > maxDur + 5) {
      currentSesi.selesaiAt = start + maxDur * 60000;
    }
  }

  return currentSesi;
}
