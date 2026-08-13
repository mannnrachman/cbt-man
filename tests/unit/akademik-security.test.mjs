/**
 * Contract and regression tests for Academic Structure Security and Integrity.
 *
 * Run with:  node --test tests/unit/akademik-security.test.mjs
 *            (or)  npm run test:unit
 */

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

function read(rel) {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

test("mutateFakultasServer enforces discriminated union and strict schema validator", () => {
  const src = read("src/lib/server/akademik/functions.ts");
  assert.ok(
    !/payload:\s*z\.any\(\)/.test(src),
    "functions.ts must not use payload: z.any() (A08 / Type bypass vulnerability)",
  );
  assert.ok(
    /MutateFakultasSchema/.test(src),
    "mutateFakultasServer must use MutateFakultasSchema",
  );
  assert.ok(
    /MutateProgramStudiSchema/.test(src),
    "mutateProgramStudiServer must use MutateProgramStudiSchema",
  );
  assert.ok(
    /MutateRombelSchema/.test(src),
    "mutateRombelServer must use MutateRombelSchema",
  );
});

test("academic mutations perform relational integrity checks before deletion", () => {
  const src = read("src/lib/server/akademik/functions.ts");
  assert.ok(
    /prisma\.programStudi\.count\(/.test(src),
    "Fakultas deletion must check child programStudi count",
  );
  assert.ok(
    /prisma\.rombel\.count\(/.test(src),
    "ProgramStudi / TahunAkademik deletion must check child rombel count",
  );
  assert.ok(
    /prisma\.user\.count\(/.test(src),
    "Rombel deletion must check child user count",
  );
});

test("academic functions require caller and guard against unauthorized mutation", () => {
  const src = read("src/lib/server/akademik/functions.ts");
  assert.ok(
    /requireSuperAdmin/.test(src),
    "Mutations must enforce requireSuperAdmin",
  );
  assert.ok(
    /requireCaller/.test(src),
    "List functions must enforce requireCaller",
  );
});

test("client forms use secure cryptographic uid instead of Date.now()", () => {
  const src = read("src/routes/_authenticated/admin.akademik.index.tsx");
  assert.ok(
    !/Date\.now\(\)/.test(src),
    "admin.akademik.index.tsx must not use Date.now() for entity IDs",
  );
  assert.ok(
    /uid\("f_"\)/.test(src) && /uid\("p_"\)/.test(src) && /uid\("r_"\)/.test(src),
    "admin.akademik.index.tsx must use uid() with proper prefix",
  );
});
