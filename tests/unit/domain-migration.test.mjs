import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

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
});

test("backup includes course classes and exams lock after a session exists", () => {
  const backup = read("src/lib/cbt/backup.ts");
  const server = read("src/lib/server/backup/functions.ts");
  const exam = read("src/lib/server/ujian/functions.ts");
  assert.match(backup, /penawaran: penawaranRepo\.all\(\)/);
  assert.match(server, /penawaranMataKuliah\.createMany/);
  assert.match(exam, /Paket tidak dapat diubah karena sudah memiliki sesi peserta/);
});
