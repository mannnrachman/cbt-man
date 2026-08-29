import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parseJsonArray, validateExamTopicSets } from "../../scripts/domain-json.mjs";

function read(rel) {
  return readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");
}

test("domain migration has a read-only preflight", () => {
  const script = read("scripts/preflight-domain-migration.mjs");
  assert.match(script, /readyForDomainMigration/);
  assert.match(script, /module_without_course/);
  assert.match(script, /topic_without_course/);
  assert.match(script, /duplicate_session/);
  assert.match(script, /legacy_token_without_claim/);
  assert.doesNotMatch(script, /\.deleteMany\(/);
});

test("development and build refresh Prisma Client before starting", () => {
  const packageJson = JSON.parse(read("package.json"));
  assert.equal(packageJson.scripts.predev, "prisma generate");
  assert.equal(packageJson.scripts.prebuild, "prisma generate");
});

test("legacy module remediation is explicit and non-destructive by default", () => {
  const script = read("scripts/remediate-legacy-module-courses.mjs");
  assert.match(script, /process\.argv\.includes\("--apply"\)/);
  assert.match(script, /prisma\.modul\.update/);
  assert.doesNotMatch(script, /deleteMany/);
  assert.match(script, /topic\.mataKuliahId \?\? topic\.modul\.mataKuliahId/);
});

test("domain scripts reject malformed or non-array exam topicSets before writes", () => {
  assert.equal(parseJsonArray("{"), null);
  assert.equal(parseJsonArray('{"topikId":"t_1"}'), null);
  assert.deepEqual(parseJsonArray('[{"topikId":"t_1"}]'), [{ topikId: "t_1" }]);
  assert.throws(
    () => validateExamTopicSets([{ id: "uj_bad", topicSets: "{}" }]),
    /bukan JSON array valid/,
  );

  const remediation = read("scripts/remediate-legacy-module-courses.mjs");
  assert.ok(
    remediation.indexOf("validateExamTopicSets(await prisma.ujian.findMany") < remediation.indexOf("for (const mapping"),
    "all exams must be validated before remediation writes",
  );
});

test("legacy session report uses the domain finished status", () => {
  const report = read("scripts/report-legacy-sessions.mjs");
  assert.match(report, /session\.status === "selesai"/);
  assert.doesNotMatch(report, /session\.status === "finished"/);
});

test("backup includes course classes and exams lock after a session exists", () => {
  const backup = read("src/lib/cbt/backup.ts");
  const server = read("src/lib/server/backup/functions.ts");
  const exam = read("src/lib/server/ujian/functions.ts");
  assert.match(backup, /penawaran: penawaranRepo\.all\(\)/);
  assert.match(server, /penawaranMataKuliah\.createMany/);
  assert.match(exam, /Paket tidak dapat diubah karena sudah memiliki sesi peserta/);
});

test("offering core updates do not overwrite concurrent membership changes", () => {
  const server = read("src/lib/server/akademik/functions.ts");
  const start = server.indexOf("export const mutatePenawaranMataKuliahServer");
  const end = server.indexOf("export const getPenawaranMataKuliahList", start);
  const body = server.slice(start, end);
  const update = body.slice(body.indexOf("update:"), body.indexOf("create:"));
  assert.doesNotMatch(update, /pengampuIds|pesertaIds/);
  assert.match(body, /create:[\s\S]*pengampuIds:[\s\S]*pesertaIds:/);
});
