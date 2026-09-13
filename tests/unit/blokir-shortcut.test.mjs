import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function read(rel) {
  return readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");
}

test("kerjakan registers copy/cut/paste/contextmenu blockers when blokirShortcut is used", () => {
  const src = read("src/routes/_authenticated/peserta.ujian.$id.kerjakan.tsx");
  assert.match(src, /blokirShortcut/);
  assert.match(src, /activeSesiStatus !== "sedang"/);
  for (const eventName of ["copy", "cut", "paste", "contextmenu"]) {
    assert.match(src, new RegExp(`addEventListener\\("${eventName}"`));
    assert.match(src, new RegExp(`removeEventListener\\("${eventName}"`));
  }
  assert.match(src, /preventDefault\(\)/);
});
