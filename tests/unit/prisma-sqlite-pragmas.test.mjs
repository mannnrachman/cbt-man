import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const src = readFileSync(new URL("../../src/lib/server/db/prisma.ts", import.meta.url), "utf8");

test("prisma.ts enables SQLite WAL and busy_timeout only for file: URLs", () => {
  assert.match(src, /PRAGMA journal_mode=WAL/);
  assert.match(src, /PRAGMA busy_timeout=5000/);
  assert.match(src, /startsWith\("file:"\)/);
  assert.doesNotMatch(src, /postgres|postgresql|pg\b/i);
});
