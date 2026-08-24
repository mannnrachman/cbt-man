import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function read(rel) {
  return readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");
}

test("exam list exposes class assignment and lifecycle status", () => {
  const route = read("src/routes/_authenticated/admin.ujian.tsx");
  assert.match(route, /penawaranRepo/);
  assert.match(route, /kelas\.pesertaIds\.length/);
  assert.match(route, /u\.status === "published"/);
});
