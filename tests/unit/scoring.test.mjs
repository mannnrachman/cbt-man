import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { gradeAnswers } from "../../src/lib/cbt/scoring.ts";

function soal(id, tipe, jawaban) {
  return {
    id,
    topikId: "topik-1",
    detail: `Soal ${id}`,
    tipe,
    kesulitan: "sedang",
    jawaban,
    pembahasan: "",
    createdAt: 0,
  };
}

function opt(id, benar) {
  return { id, detail: `Opsi ${id}`, benar };
}

function jawaban(soalId, jawabanIds = [], jawabanEssay = "") {
  return { soalId, jawabanIds, jawabanEssay, ragu: false };
}

function ujian(overrides = {}) {
  return { poinBenar: 1, poinSalah: 0, poinKosong: 0, ...overrides };
}

const PG = soal("pg-1", "pg", [opt("a", true), opt("b", false)]);
const BS = soal("bs-1", "bs", [opt("a", false), opt("b", true)]);
const MULTI = soal("multi-1", "multi", [opt("a", true), opt("b", true), opt("c", false)]);
const ESSAY = soal("es-1", "essay", []);

const allSoal = [PG, BS, MULTI, ESSAY];
const soalById = new Map(allSoal.map((s) => [s.id, s]));

test("gradeAnswers gives poinBenar for a correct single-answer soal", () => {
  const { skorTotal, maxSkor } = gradeAnswers(ujian({ poinBenar: 2 }), soalById, [
    jawaban(PG.id, ["a"]),
  ]);
  assert.equal(skorTotal, 2);
  assert.equal(maxSkor, 2);
});

test("gradeAnswers gives poinSalah for a wrong answer and poinKosong for empty", () => {
  const u = ujian({ poinBenar: 3, poinSalah: -1, poinKosong: 0.5 });
  const { jawaban: graded, skorTotal } = gradeAnswers(u, soalById, [
    jawaban(PG.id, ["b"]),
    jawaban(BS.id, []),
  ]);
  assert.equal(graded[0].skor, -1);
  assert.equal(graded[1].skor, 0.5);
  assert.equal(skorTotal, -0.5);
});

test("gradeAnswers requires exact match for multi-benar soal", () => {
  const u = ujian({ poinBenar: 4, poinSalah: 0 });
  const partial = gradeAnswers(u, soalById, [jawaban(MULTI.id, ["a"])]);
  assert.equal(partial.jawaban[0].skor, 0);

  const full = gradeAnswers(u, soalById, [jawaban(MULTI.id, ["a", "b"])]);
  assert.equal(full.jawaban[0].skor, 4);
  assert.equal(full.skorTotal, 4);
});

test("gradeAnswers leaves essay ungraded but counts it in maxSkor", () => {
  const u = ujian({ poinBenar: 5 });
  const {
    jawaban: graded,
    skorTotal,
    maxSkor,
  } = gradeAnswers(u, soalById, [jawaban(ESSAY.id, [], "Jawaban essay")]);
  assert.equal(graded[0].skor, undefined);
  assert.equal(skorTotal, 0);
  assert.equal(maxSkor, 5);
});

test("gradeAnswers adds an already-graded essay skor into the total", () => {
  const u = ujian({ poinBenar: 5 });
  const answer = { ...jawaban(ESSAY.id, [], "Jawaban essay"), skor: 4 };
  const { skorTotal, maxSkor } = gradeAnswers(u, soalById, [answer]);
  assert.equal(skorTotal, 4);
  assert.equal(maxSkor, 5);
});

test("gradeAnswers computes maxSkor as soal count times poinBenar including essays", () => {
  const u = ujian({ poinBenar: 2 });
  const { skorTotal, maxSkor } = gradeAnswers(u, soalById, [
    jawaban(PG.id, ["a"]),
    jawaban(BS.id, ["a"]),
    jawaban(MULTI.id, []),
    jawaban(ESSAY.id, [], "esai"),
  ]);
  assert.equal(skorTotal, 2);
  assert.equal(maxSkor, 8);
});

test("gradeAnswers leaves unknown soal entries untouched", () => {
  const u = ujian();
  const ghost = jawaban("soal-hilang", ["x"]);
  const { jawaban: graded, skorTotal, maxSkor } = gradeAnswers(u, soalById, [ghost]);
  assert.equal(graded[0], ghost);
  assert.equal(skorTotal, 0);
  assert.equal(maxSkor, 0);
});

test("participant session mutation accepts only answer fields and preserves completed force-submits", () => {
  const source = readFileSync(new URL("../../src/lib/server/sesi/functions.ts", import.meta.url), "utf8");
  assert.match(source, /const participantAnswerSchema = z[\s\S]*?\.strict\(\)/);
  assert.match(source, /if \(caller\.role === "mahasiswa"\)[\s\S]{0,100}Forbidden/);
  assert.match(source, /where: \{ id: data\.sesiId, pesertaId: caller\.id, status: "sedang" \}/);
  assert.match(source, /if \(sesi\.status === "selesai"\) return \{ ok: true as const \}/);
  assert.match(source, /await gradeSesiServerSide\(upsertItem\)/);
  assert.match(source, /gradedAt: Date\.now\(\)/);
  assert.match(source, /gradedBy: caller\.id/);
  assert.match(source, /existingStatus !== "selesai" && existing\?\.status === "selesai"/);
  assert.match(source, /existing\?\.status === "selesai" && upsertItem\.status !== "selesai"/);
  assert.match(source, /skor: grading\.skor, catatanGrader: grading\.catatanGrader/);
});
