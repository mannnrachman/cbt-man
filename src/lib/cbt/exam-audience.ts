import type { UnitAkademik } from "./types";

export type ExamAudienceMode = "kelas" | "jurusan";

export function getExamAudienceMode(units: Pick<UnitAkademik, "tipe">[]): ExamAudienceMode | null {
  if (units.length === 0) return null;
  if (units.every((unit) => unit.tipe === "kelas")) return "kelas";
  if (units.every((unit) => unit.tipe === "jurusan" || unit.tipe === "prodi")) return "jurusan";
  return null;
}
