import assert from "node:assert/strict";
import test from "node:test";
import { filterModuls } from "../../src/lib/cbt/modul-filter.mjs";

test("module search keeps matching modules without a course association", () => {
  const modules = [
    { nama: "Jaringan Komputer" },
    { nama: "Basis Data", mataKuliahId: "mk_1" },
  ];

  assert.deepEqual(filterModuls(modules, "jaringan"), [modules[0]]);
  assert.deepEqual(filterModuls(modules, ""), modules);
});
