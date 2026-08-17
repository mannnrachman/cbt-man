/**
 * Structural regression test for hidden/unenforced policy controls (Issue #13).
 *
 * Run with:  node --test tests/unit/policy-controls-hidden.test.mjs
 *            (or)  npm run test:unit
 *
 * V1 is hide-and-document: the `mobileLock` and `multiDevice` controls in the
 * admin settings page must be rendered DISABLED with a "Belum diberlakukan"
 * (not-yet-enforced) badge so they cannot imply protection that does not
 * exist. This test reads the settings source and guards against a silent
 * re-enable. Written as .mjs to match tests/unit/rich-text-sanitize.test.mjs.
 */

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const settingsSrc = readFileSync(
  resolve(process.cwd(), "src/routes/_authenticated/admin.pengaturan.tsx"),
  "utf8",
);

/** Extract the JSX text of a `<ToggleRow ... />` self-closing element bound to
 *  the given config field (e.g. `cfg.mobileLock`). */
function toggleRowFor(field) {
  const re = new RegExp(`<ToggleRow\\b[\\s\\S]*?cfg\\.${field}[\\s\\S]*?/>`, "m");
  const m = settingsSrc.match(re);
  assert.ok(m, `expected a <ToggleRow> bound to cfg.${field}`);
  return m[0];
}

for (const field of ["mobileLock", "multiDevice"]) {
  test(`${field} toggle is rendered disabled`, () => {
    const row = toggleRowFor(field);
    assert.ok(
      /\bdisabled\b/.test(row),
      `${field} ToggleRow must pass disabled so it cannot imply enforcement`,
    );
  });

  test(`${field} toggle shows the not-enforced badge`, () => {
    const row = toggleRowFor(field);
    assert.ok(
      /Belum diberlakukan/.test(row),
      `${field} ToggleRow must carry the "Belum diberlakukan" badge`,
    );
  });
}

test("ToggleRow component supports disabled + badge props", () => {
  assert.ok(/disabled\??\s*[:=]/.test(settingsSrc), "ToggleRow must accept a disabled prop");
  assert.ok(/badge\??\s*[:=]/.test(settingsSrc), "ToggleRow must accept a badge prop");
});

test("no fake enforcement logic was introduced (V1 is hide-only)", () => {
  // Guard against someone adding bypassable client-side device/IP checks here.
  assert.ok(
    !/navigator\.userAgent|matchMedia|x-forwarded-for|CIDR/i.test(settingsSrc),
    "settings page must not contain device/IP enforcement (deferred to V2)",
  );
});

test("nilai normal is persisted, default-off, and gated in admin + participant UI", () => {
  const read = (path) => readFileSync(resolve(process.cwd(), path), "utf8");
  const schema = read("prisma/schema.prisma");
  const type = read("src/lib/cbt/types.ts");
  const mapper = read("src/lib/server/repos/mappers.ts");
  const editor = read("src/routes/_authenticated/admin.ujian.$id.tsx");
  const preExam = read("src/routes/_authenticated/peserta.ujian.$id.index.tsx");
  const exam = read("src/routes/_authenticated/peserta.ujian.$id.kerjakan.tsx");

  assert.match(schema, /allowNilaiNormal\s+Boolean\s+@default\(false\)/, "schema must persist allowNilaiNormal defaulting to false");
  assert.match(type, /allowNilaiNormal:\s*z\.boolean\(\)\.default\(false\)/, "UjianSchema must default allowNilaiNormal to false");
  assert.match(mapper, /allowNilaiNormal:\s*Boolean\(row\.allowNilaiNormal\)/, "mapUjian must expose allowNilaiNormal");
  assert.match(editor, /id="allow-nilai-normal"/, "admin editor must render the allowNilaiNormal switch");
  assert.match(preExam, /ujian\.allowNilaiNormal/, "pre-exam notice must be gated by allowNilaiNormal");
  assert.match(exam, /if \(!ujian\.allowNilaiNormal\) return null;/, "participant exam UI must gate the nilai normal dialog");
});
