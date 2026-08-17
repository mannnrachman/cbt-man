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
 * wins when a soal is shared with a non-revealed sesi.
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

function read(rel) {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

/** Pure model of the reveal policy in pesertaSnapshot. */
function snapshotSoalPolicy({ sesi, ujian, soal }) {
  const ujianById = new Map(ujian.map((u) => [u.id, u]));
  const revealed = new Set();
  const withheld = new Set();
  for (const s of sesi) {
    const u = ujianById.get(s.ujianId);
    const canReveal = s.status === "selesai" && !!u?.showResult && !!u.showResultDetail;
    for (const id of s.soalIds) (canReveal ? revealed : withheld).add(id);
  }
  for (const id of withheld) revealed.delete(id);
  return soal
    .filter((row) => sesi.some((s) => s.soalIds.includes(row.id)))
    .map((row) => {
      if (revealed.has(row.id)) return row;
      return {
        ...row,
        jawaban: row.jawaban.map((j) => ({ ...j, benar: false })),
        pembahasan: "",
      };
    });
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
    sesi: [{ ujianId: "uj_1", soalIds: ["s_1"], status: sesiStatus }],
    soal: [structuredClone(SOAL)],
  };
}

test("redacts answer key and pembahasan while the sesi is in progress", () => {
  const [soal] = snapshotSoalPolicy(base({ sesiStatus: "berlangsung" }));
  assert.ok(soal.jawaban.every((j) => j.benar === false));
  assert.equal(soal.pembahasan, "");
  // The question body stays available so the exam can be rendered.
  assert.equal(soal.detail, "Soal");
  assert.equal(soal.jawaban.length, 2);
});

test("reveals answer key and pembahasan after selesai when result detail is published", () => {
  const [soal] = snapshotSoalPolicy(base({ sesiStatus: "selesai" }));
  assert.equal(soal.jawaban[0].benar, true);
  assert.equal(soal.pembahasan, "Pembahasan rahasia");
});

test("keeps redaction when the exam hides result detail", () => {
  const [soal] = snapshotSoalPolicy(base({ sesiStatus: "selesai", showResultDetail: false }));
  assert.ok(soal.jawaban.every((j) => j.benar === false));
  assert.equal(soal.pembahasan, "");
});

test("keeps redaction when the exam hides results entirely", () => {
  const [soal] = snapshotSoalPolicy(base({ sesiStatus: "selesai", showResult: false }));
  assert.ok(soal.jawaban.every((j) => j.benar === false));
  assert.equal(soal.pembahasan, "");
});

test("redaction wins when the same soal is reused by an ongoing exam", () => {
  const db = base({ sesiStatus: "selesai" });
  db.ujian.push({ id: "uj_2", showResult: true, showResultDetail: true });
  db.sesi.push({ ujianId: "uj_2", soalIds: ["s_1"], status: "berlangsung" });
  const [soal] = snapshotSoalPolicy(db);
  assert.ok(soal.jawaban.every((j) => j.benar === false));
  assert.equal(soal.pembahasan, "");
});

test("snapshot.ts redacts benar and pembahasan server-side", () => {
  const src = read("src/lib/server/repos/snapshot.ts");
  const fnIdx = src.indexOf("export function pesertaSnapshot(");
  assert.ok(fnIdx > 0, "pesertaSnapshot must exist");
  const body = src.slice(fnIdx, fnIdx + 2500);
  assert.match(body, /status === "selesai" && !!u\?\.showResult && !!u\.showResultDetail/);
  assert.match(body, /benar: false/);
  assert.match(body, /pembahasan: ""/);
});

test("kerjakan no longer grades client-side and re-hydrates after submit", () => {
  const src = read("src/routes/_authenticated/peserta.ujian.$id.kerjakan.tsx");
  assert.ok(!/function gradeSesi\(/.test(src), "client-side gradeSesi must be removed");
  assert.match(src, /function finalizeSesi\(/, "finalizeSesi must finalize without scoring");
  assert.match(src, /skorTotal\s*=\s*undefined/, "client must not compute skorTotal");
  assert.match(src, /await sesiRepo\.flush\(\)/, "submit must flush to the server");
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
