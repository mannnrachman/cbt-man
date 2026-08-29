import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { validateParticipantAnswers } from "../../src/lib/cbt/session-answers.ts";

const pg = {
  id: "pg-1",
  tipe: "pg",
  jawaban: [
    { id: "a", detail: "A", benar: true },
    { id: "b", detail: "B", benar: false },
  ],
};
const essay = { id: "essay-1", tipe: "essay", jawaban: [] };
const soalById = new Map([
  [pg.id, pg],
  [essay.id, essay],
]);

function answer(soalId, overrides = {}) {
  return { soalId, jawabanIds: [], jawabanEssay: "", ragu: false, ...overrides };
}

test("participant answers are reordered to the canonical session question order", () => {
  const result = validateParticipantAnswers([pg.id, essay.id], soalById, [
    answer(essay.id, { jawabanEssay: "Jawaban" }),
    answer(pg.id, { jawabanIds: ["a"] }),
  ]);

  assert.deepEqual(
    result?.map((item) => item.soalId),
    [pg.id, essay.id],
  );
});

test("participant answers reject missing, duplicate, and foreign questions", () => {
  assert.equal(validateParticipantAnswers([pg.id, essay.id], soalById, [answer(pg.id)]), null);
  assert.equal(
    validateParticipantAnswers([pg.id, essay.id], soalById, [answer(pg.id), answer(pg.id)]),
    null,
  );
  assert.equal(validateParticipantAnswers([pg.id], soalById, [answer("foreign-question")]), null);
});

test("participant answers reject foreign, duplicate, and invalid option shapes", () => {
  assert.equal(
    validateParticipantAnswers([pg.id], soalById, [answer(pg.id, { jawabanIds: ["foreign"] })]),
    null,
  );
  assert.equal(
    validateParticipantAnswers([pg.id], soalById, [answer(pg.id, { jawabanIds: ["a", "a"] })]),
    null,
  );
  assert.equal(
    validateParticipantAnswers([pg.id], soalById, [answer(pg.id, { jawabanIds: ["a", "b"] })]),
    null,
  );
  assert.equal(
    validateParticipantAnswers([essay.id], soalById, [
      answer(essay.id, { jawabanIds: ["a"], jawabanEssay: "Jawaban" }),
    ]),
    null,
  );
});

test("participant route never writes through the generic session repository", () => {
  const route = readFileSync(
    new URL("../../src/routes/_authenticated/peserta.ujian.$id.kerjakan.tsx", import.meta.url),
    "utf8",
  );
  const server = readFileSync(
    new URL("../../src/lib/server/sesi/functions.ts", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(route, /sesiRepo\.(upsert|flush)/);
  assert.match(route, /saveParticipantSession\(sesiRef\.current, true\)/);
  assert.doesNotMatch(route, /\bconfirm\(/);
  assert.match(route, /<Dialog open=\{showSubmitDialog\}/);
  assert.match(route, /Ya, Kumpulkan/);
  assert.match(server, /if \(caller\.role === "mahasiswa"\)[\s\S]{0,100}Forbidden/);
  assert.match(server, /status: "sedang"/);
  assert.match(server, /now > endsAt/);
  assert.match(server, /now > examEndAt/);
  assert.match(server, /timedOut && \(data\.action !== "submit"/);
});

test("participant transport failures rehydrate optimistic session state", () => {
  const repos = readFileSync(new URL("../../src/lib/cbt/repos.ts", import.meta.url), "utf8");

  assert.match(repos, /saveParticipantSesiServer\([\s\S]*?\.catch\(\(error\) =>/);
  assert.match(repos, /notifyMutationFailure\("jawaban ujian", message\)/);
});

test("participant polling reads only the current session state", () => {
  const route = readFileSync(
    new URL("../../src/routes/_authenticated/peserta.ujian.$id.kerjakan.tsx", import.meta.url),
    "utf8",
  );
  const server = readFileSync(
    new URL("../../src/lib/server/sesi/functions.ts", import.meta.url),
    "utf8",
  );

  assert.match(route, /getParticipantSessionState\(sesi\.id\)/);
  assert.match(server, /getParticipantSesiStateServer/);
  assert.match(server, /select: \{ id: true, ujianId: true, pesertaId: true, status: true, endsAt: true \}/);
  assert.match(server, /sesi\.pesertaId !== caller\.id/);
  assert.match(server, /pesertaCanTouchUjian\(caller, sesi\.ujianId\)/);
  assert.match(route, /if \(pollInFlight\) return/);
  assert.match(route, /pollInFlight = false/);
});
