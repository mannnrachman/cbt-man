/**
 * Regression pins for the landing label and essay result rendering (#120).
 *
 * - Tombol pembuka modal login di landing harus berlabel "Login Peserta",
 *   bukan "Mulai Ujian Online" (tombol itu membuka modal login, bukan ujian).
 * - jawabanEssay adalah plain text dari <Textarea> — halaman hasil harus
 *   merendernya sebagai teks (React auto-escape + whitespace-pre-wrap), bukan
 *   memparse-nya sebagai HTML lewat RichView.
 */

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

function read(rel) {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

test("landing login-modal trigger is labeled Login Peserta", () => {
  const src = read("src/routes/index.tsx");
  const idx = src.indexOf("onClick={handleOpenLoginGeneral}");
  assert.ok(idx > 0, "landing must keep the login-modal trigger");
  const block = src.slice(idx - 400, idx + 900);
  assert.match(block, /type="button"/, "login trigger must not submit a surrounding form");
  assert.match(block, /Login Peserta/, "button label must be Login Peserta");
  assert.ok(!/Mulai Ujian Online/.test(block), "misleading label must be gone");
});

test("hasil renders jawabanEssay as plain text, not through RichView", () => {
  const src = read("src/routes/_authenticated/peserta.ujian.$id.hasil.tsx");
  assert.ok(
    !/RichView html=\{j\.jawabanEssay/.test(src),
    "jawabanEssay must not be parsed as HTML (plain text from Textarea)",
  );
  assert.match(
    src,
    /whitespace-pre-wrap[^>]*>\{j\.jawabanEssay\}/,
    "jawabanEssay must render as escaped text preserving line breaks",
  );
  assert.match(
    src,
    /j\.jawabanEssay\?\.trim\(\)\s*\?/,
    "blank and whitespace-only essay answers must use the fallback branch",
  );
  assert.match(src, /<em[^>]*>\(Kosong\)<\/em>/, "empty essay fallback must remain visible");
});
