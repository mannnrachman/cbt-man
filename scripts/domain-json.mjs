export function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value ?? "");
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function validateExamTopicSets(exams) {
  return exams.map((exam) => {
    const sets = parseJsonArray(exam.topicSets);
    if (!sets) throw new Error(`Paket ${exam.id} memiliki topicSets yang bukan JSON array valid.`);
    return { ...exam, sourceIds: sets.map((item) => item?.topikId).filter(Boolean) };
  });
}
