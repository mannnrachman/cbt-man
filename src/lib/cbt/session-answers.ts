import type { JawabanSesi, SesiUjian, Soal, Ujian } from "./types";

type ParticipantAnswer = Pick<JawabanSesi, "soalId" | "jawabanIds" | "jawabanEssay" | "ragu">;

export const participantQuestionId = (sessionId: string, soalId: string) => `${sessionId}:${soalId}`;

export function participantSessionQuestions(
  sessions: SesiUjian[],
  exams: Ujian[],
  currentQuestions: Soal[],
): Soal[] {
  const examById = new Map(exams.map((item) => [item.id, item]));
  const currentById = new Map(currentQuestions.map((item) => [item.id, item]));
  return sessions.flatMap((session) => {
    const exam = examById.get(session.ujianId);
    const canReveal = session.status === "selesai" && !!exam?.showResult && !!exam.showResultDetail;
    const snapshotById = new Map(session.soalSnapshot.map((item) => [item.id, item]));
    return session.soalIds.flatMap((id) => {
      const source = snapshotById.get(id) ?? currentById.get(id);
      if (!source) return [];
      const scoped = { ...source, id: participantQuestionId(session.id, id) };
      return canReveal
        ? scoped
        : {
            ...scoped,
            jawaban: scoped.jawaban.map((item) => ({ ...item, benar: false })),
            pembahasan: "",
          };
    });
  });
}

export function validateParticipantAnswers(
  soalIds: string[],
  soalById: ReadonlyMap<string, Soal>,
  answers: ParticipantAnswer[],
): ParticipantAnswer[] | null {
  if (answers.length !== soalIds.length) return null;

  const answerBySoal = new Map(answers.map((answer) => [answer.soalId, answer]));
  if (answerBySoal.size !== answers.length) return null;

  const validated: ParticipantAnswer[] = [];
  for (const soalId of soalIds) {
    const soal = soalById.get(soalId);
    const answer = answerBySoal.get(soalId);
    if (!soal || !answer) return null;

    const selected = new Set(answer.jawabanIds);
    const allowed = new Set(soal.jawaban.map((option) => option.id));
    if (selected.size !== answer.jawabanIds.length) return null;
    if ([...selected].some((id) => !allowed.has(id))) return null;
    if (soal.tipe === "essay" && selected.size > 0) return null;
    if (soal.tipe !== "essay" && answer.jawabanEssay !== "") return null;
    if (soal.tipe !== "multi" && soal.tipe !== "essay" && selected.size > 1) return null;

    validated.push({
      soalId,
      jawabanIds: [...selected],
      jawabanEssay: answer.jawabanEssay,
      ragu: answer.ragu,
    });
  }

  return validated;
}
