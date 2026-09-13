import { strict as assert } from "node:assert";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

function read(rel) {
  return readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");
}

test("ConfirmDialog wraps the shared Dialog primitive", () => {
  const src = read("src/components/cbt/ConfirmDialog.tsx");
  assert.match(src, /from "@\/components\/ui\/dialog"/);
  assert.match(src, /export function ConfirmDialog/);
  assert.match(src, /export function useConfirmDialog/);
});

test("RichEditor icon toolbar exposes aria-label without changing display-mode confirm", () => {
  const src = read("src/components/cbt/RichEditor.tsx");
  assert.match(src, /aria-label=\{t\}/);
  assert.match(src, /window\.confirm\(/);
});

test("admin routes do not keep native confirm() for destructive actions", () => {
  const dir = new URL("../../src/routes/_authenticated/", import.meta.url);
  const adminFiles = readdirSync(dir)
    .filter((name) => name.startsWith("admin.") && name.endsWith(".tsx"))
    .map((name) => `src/routes/_authenticated/${name}`);

  assert.ok(adminFiles.length > 0);

  for (const rel of adminFiles) {
    const src = read(rel);
    assert.doesNotMatch(src, /if\s*\(\s*!confirm\(/, `${rel} still uses native confirm()`);
    assert.doesNotMatch(src, /window\.confirm\(/, `${rel} still uses window.confirm()`);
  }

  const peserta = read("src/routes/_authenticated/peserta.tsx");
  assert.match(peserta, /confirm\("Keluar dari ujian/);
});
