/**
 * Unit tests for the participant snapshot answer-key redaction.
 *
 * Run with:  node --test tests/unit/snapshot-redaction.test.mjs
 *            (or)  npm run test:unit
 *
 * `pesertaSnapshot` must never leak `jawaban[].benar` (the answer key) or
 * `pembahasan` to a participant while their sesi is still in progress, or when
 * the exam hides results / result detail. They are only exposed once the sesi
 * is `selesai` AND the exam sets `showResult && showResultDetail`. Redaction
 * is evaluated independently for each session when a question is reused.
 *
 * The behavioral matrix below models the exact policy implemented in
 * src/lib/server/repos/snapshot.ts; the static pins assert the production code
 * keeps implementing it (source-grep convention, mirroring
 * tests/unit/snapshot-lockdown.test.mjs).
 */

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { participantSessionQuestions } from "../../src/lib/cbt/session-answers.ts";

function read(rel) {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

const SOAL = {
  id: "s_1",
  detail: "Soal",
  jawaban: [
    { id: "j_1", detail: "A", benar: true },
    { id: "j_2", detail: "B", benar: false },
  ],
  pembahasan: "Pembahasan rahasia",
};

function base({ sesiStatus, showResult = true, showResultDetail = true }) {
  return {
    ujian: [{ id: "uj_1", showResult, showResultDetail }],
    sesi: [
      {
        id: "se_1",
        ujianId: "uj_1",
        soalIds: ["s_1"],
        soalSnapshot: [structuredClone(SOAL)],
        status: sesiStatus,
      },
    ],
    soal: [structuredClone(SOAL)],
  };
}

test("redacts answer key and pembahasan while the sesi is in progress", () => {
  const data = base({ sesiStatus: "berlangsung" });
  const [soal] = participantSessionQuestions(data.sesi, data.ujian, data.soal);
  assert.ok(soal.jawaban.every((j) => j.benar === false));
  assert.equal(soal.pembahasan, "");
  // The question body stays available so the exam can be rendered.
  assert.equal(soal.detail, "Soal");
  assert.equal(soal.jawaban.length, 2);
});

test("reveals answer key and pembahasan after selesai when result detail is published", () => {
  const data = base({ sesiStatus: "selesai" });
  const [soal] = participantSessionQuestions(data.sesi, data.ujian, data.soal);
  assert.equal(soal.jawaban[0].benar, true);
  assert.equal(soal.pembahasan, "Pembahasan rahasia");
});

test("keeps redaction when the exam hides result detail", () => {
  const data = base({ sesiStatus: "selesai", showResultDetail: false });
  const [soal] = participantSessionQuestions(data.sesi, data.ujian, data.soal);
  assert.ok(soal.jawaban.every((j) => j.benar === false));
  assert.equal(soal.pembahasan, "");
});

test("keeps redaction when the exam hides results entirely", () => {
  const data = base({ sesiStatus: "selesai", showResult: false });
  const [soal] = participantSessionQuestions(data.sesi, data.ujian, data.soal);
  assert.ok(soal.jawaban.every((j) => j.benar === false));
  assert.equal(soal.pembahasan, "");
});

test("keeps reused question snapshots scoped to their originating session", () => {
  const db = base({ sesiStatus: "selesai" });
  db.ujian.push({ id: "uj_2", showResult: true, showResultDetail: true });
  db.sesi[0].soalSnapshot[0].detail = "Snapshot sesi pertama";
  db.sesi.push({
    id: "se_2",
    ujianId: "uj_2",
    soalIds: ["s_1"],
    soalSnapshot: [{ ...structuredClone(SOAL), detail: "Snapshot sesi kedua" }],
    status: "berlangsung",
  });
  const [revealed, redacted] = participantSessionQuestions(db.sesi, db.ujian, db.soal);
  assert.equal(revealed.id, "se_1:s_1");
  assert.equal(revealed.detail, "Snapshot sesi pertama");
  assert.equal(revealed.jawaban[0].benar, true);
  assert.equal(redacted.id, "se_2:s_1");
  assert.equal(redacted.detail, "Snapshot sesi kedua");
  assert.ok(redacted.jawaban.every((j) => j.benar === false));
});

test("participant snapshot never includes the exam token inventory", () => {
  const src = read("src/lib/server/repos/snapshot.ts");
  const fnIdx = src.indexOf("export function pesertaSnapshot(");
  assert.ok(fnIdx > 0, "pesertaSnapshot must exist");
  const body = src.slice(fnIdx, fnIdx + 4000);
  assert.match(body, /token:\s*\[\]/);
  assert.doesNotMatch(body, /token\.map\(mapToken\)/);
});

test("operator snapshot applies Mata Kuliah scope instead of treating empty topic scope as global", () => {
  const snapshot = read("src/lib/server/repos/snapshot.ts");
  const fnIdx = snapshot.indexOf("export function operatorSnapshot(");
  assert.ok(fnIdx > 0, "operatorSnapshot must exist");
  const body = snapshot.slice(fnIdx, snapshot.indexOf("export function pesertaSnapshot(", fnIdx));
  assert.match(body, /caller\.mataKuliahIds/);
  assert.match(body, /allowedMataKuliahIds/);
  assert.match(body, /parsedAllowedTopikIds\.length === 0/);
  assert.match(body, /parsedMataKuliahIds\.length === 0/);
  assert.match(body, /penawaranById\.get\(item\.penawaranId\)/);
  assert.match(body, /allowedMataKuliahIds\.has\(penawaran\.mataKuliahId\)/);
});

test("participant pages resolve questions by session and question id", () => {
  const kerjakan = read("src/routes/_authenticated/peserta.ujian.$id.kerjakan.tsx");
  const hasil = read("src/routes/_authenticated/peserta.ujian.$id.hasil.tsx");
  assert.match(kerjakan, /soalBySessionId\(sesi\.id, soalId\)/);
  assert.match(hasil, /soalBySessionId\(sesi\.id, j\.soalId\)/);
  assert.match(kerjakan, /jawabanOrder\[currentJawaban\.soalId\]/);
});

test("question mutation awaits the server-side topic scope check", () => {
  const src = read("src/lib/server/modul/functions.ts");
  assert.match(src, /if \(\!\(await operatorCanTouchTopikId\(caller, item\.topikId\)\)\)/);
});

test("kerjakan submits through the narrow server action and re-hydrates authoritative results", () => {
  const src = read("src/routes/_authenticated/peserta.ujian.$id.kerjakan.tsx");
  assert.ok(!/function gradeSesi\(/.test(src), "client-side gradeSesi must be removed");
  assert.ok(!/function finalizeSesi\(/.test(src), "client must not construct submitted session state");
  assert.match(
    src,
    /await saveParticipantSession\(sesiRef\.current, true\)/,
    "submit must use the narrow participant server action",
  );
  assert.match(src, /await hydrateRepos\(\)/, "submit must re-hydrate the authoritative snapshot");
});

test("updateJawaban syncs sesiRef before setSesi so submit never finalizes stale answers", () => {
  const src = read("src/routes/_authenticated/peserta.ujian.$id.kerjakan.tsx");
  const fnIdx = src.indexOf("function updateJawaban(");
  assert.ok(fnIdx > 0, "updateJawaban must exist");
  const body = src.slice(fnIdx, fnIdx + 700);
  const refIdx = body.indexOf("sesiRef.current = nextSesi");
  const setIdx = body.indexOf("setSesi(nextSesi)");
  assert.ok(refIdx > 0, "updateJawaban must update sesiRef.current synchronously");
  assert.ok(setIdx > refIdx, "sesiRef must be updated before setSesi (ref is the submit-time source)");
});

test("hasil page only renders detail review behind showResult && showResultDetail", () => {
  const src = read("src/routes/_authenticated/peserta.ujian.$id.hasil.tsx");
  assert.match(src, /ujian\.showResult && ujian\.showResultDetail/);
});

test("public landing schedule endpoint uses a narrow DTO, not the full Ujian mapper", () => {
  const src = read("src/lib/server/exams.ts");
  assert.ok(!/mapUjian/.test(src), "getTodaysExamsServer must not map full Ujian records");
  assert.match(src, /durasiMenit:\s*row\.durasiMenit/);
  for (const leak of ["showResult", "acakSoal", "token", "poinSalah"]) {
    assert.ok(!src.includes(leak), `public schedule DTO must NOT expose ${leak}`);
  }
});
