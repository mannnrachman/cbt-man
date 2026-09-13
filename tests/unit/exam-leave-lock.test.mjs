import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function read(rel) {
  return readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");
}

test("kerjakan registers leave-surface listeners while the session is sedang", () => {
  const src = read("src/routes/_authenticated/peserta.ujian.$id.kerjakan.tsx");
  assert.match(src, /activeSesiStatus !== "sedang"/);
  assert.match(src, /document\.hidden/);
  assert.match(src, /addEventListener\("visibilitychange"/);
  assert.match(src, /removeEventListener\("visibilitychange"/);
  assert.match(src, /addEventListener\("blur"/);
  assert.match(src, /removeEventListener\("blur"/);
  assert.match(src, /role="dialog"/);
  assert.match(src, /reportExamViolation/);
  assert.match(src, /leaveQuietUntilRef/);
  assert.match(src, /Sesi ujian dikunci/);
});

test("reportExamViolation requires the caller and revokes sessions on lock", () => {
  const server = read("src/lib/server/sesi/functions.ts");
  const start = server.indexOf("export const reportExamViolation");
  assert.ok(start >= 0, "reportExamViolation must exist");
  const body = server.slice(start, start + 2800);

  assert.match(body, /requireCaller\(\)/);
  assert.match(body, /caller\.role !== "mahasiswa"/);
  assert.match(body, /deleteSessionsForUser\(caller\.id\)/);
  assert.match(body, /closeSedangSesiWithServerGrade/);
  assert.match(body, /maxPindahTab === 0 \|\| pelanggaran > maxPindahTab/);
  assert.match(body, /sesi\.examViolation/);
  assert.doesNotMatch(body, /clipboard|jawabanEssay|jawabanIds/);

  assert.match(server, /async function closeSedangSesiWithServerGrade/);
  assert.match(server, /gradeSesiServerSide\(mapSesi\(row\)\)/);
});
