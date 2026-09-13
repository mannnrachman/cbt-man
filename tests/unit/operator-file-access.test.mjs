import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function read(rel) {
  return readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");
}

test("direct file reads reuse operator topic and jurusan scope", () => {
  const src = read("src/lib/server/files/functions.ts");
  assert.match(src, /async function operatorCanAccessFile/);
  assert.match(src, /operatorCanTouchTopikId/);
  assert.match(src, /operatorCanTouchUjian/);
  assert.match(src, /meta\.jurusanId && meta\.jurusanId !== caller\.unitId/);
  assert.match(
    src,
    /if \(caller\.role === "admin_prodi" \|\| caller\.role === "evaluator"\) \{\s*if \(!\(await operatorCanAccessFile/,
  );
  assert.doesNotMatch(
    src,
    /if \(caller\.role === "super_admin" \|\| caller\.role === "admin_prodi" \|\| caller\.role === "evaluator"\) \{\s*\/\/ allowed/,
  );
});
