import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("getLiveOnlineSesis batches operatorCanTouchUjian by unique ujianId", () => {
  const server = readFileSync(
    new URL("../../src/lib/server/sesi/functions.ts", import.meta.url),
    "utf8",
  );

  const start = server.indexOf("export const getLiveOnlineSesis");
  assert.ok(start >= 0, "getLiveOnlineSesis must exist");
  const nextExport = server.indexOf("\nexport ", start + 1);
  const nextFn = server.indexOf("\nfunction ", start + 1);
  const end = Math.min(
    nextExport === -1 ? server.length : nextExport,
    nextFn === -1 ? server.length : nextFn,
  );
  const fn = server.slice(start, end);

  assert.doesNotMatch(
    fn,
    /for\s*\([^)]*of\s+rows[^)]*\)[\s\S]*?await\s+operatorCanTouchUjian/,
    "must not await operatorCanTouchUjian inside a per-row loop",
  );
  assert.match(fn, /new Set\([\s\S]*?ujianId/);
  assert.match(fn, /Promise\.all/);
  assert.match(fn, /operatorCanTouchUjian\(caller,\s*ujianId\)/);
  assert.match(fn, /caller\.role !== "super_admin"/);
});
