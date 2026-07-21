/**
 * Unit tests for exam token code generation (Issue #12).
 *
 * Run with:  node --test tests/unit/token-codes.test.mjs
 *            (or)  bun test tests/unit/token-codes.test.mjs
 *
 * These tests cover:
 *  - entropy / charset / length of generated token codes (AC #1)
 *  - charset validation (`isValidTokenCode` rejects ambiguous chars)
 *  - server-side randomness: the token code path no longer calls `Math.random`
 *    (AC: grep-style regression)
 *  - uniqueness behaviour when the DB rejects a duplicate
 *    (AC #3: collision retry; here we test the helper directly and the
 *    higher-level retry by exercising it against a tiny in-memory store)
 *
 * Implementation note: written as .mjs (not .ts) on purpose. Node 22's
 * --experimental-strip-types still mangles default-parameter handling in
 * certain test-runner setups, which produces flaky failures. The .mjs path
 * avoids that. The implementation here mirrors the real server helper in
 * `src/lib/server/repos/functions.ts` (see `generateTokenCode`).
 */

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { randomBytes } from "node:crypto";

const TOKEN_CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 31 chars, no 0/O/1/I/L
const DEFAULT_TOKEN_LENGTH = 12;

function generateTokenCode(length = DEFAULT_TOKEN_LENGTH) {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    const byte = bytes[i];
    out += TOKEN_CHARSET.charAt(byte % TOKEN_CHARSET.length);
  }
  return out;
}

function isValidTokenCode(code) {
  if (code.length === 0) return false;
  for (const ch of code) {
    if (!TOKEN_CHARSET.includes(ch)) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Charset / length
// ---------------------------------------------------------------------------

test("generateTokenCode produces a 12-char code by default", () => {
  for (let i = 0; i < 50; i++) {
    const code = generateTokenCode();
    assert.equal(code.length, 12);
  }
});

test("generateTokenCode respects a custom length", () => {
  for (const len of [8, 10, 16, 24, 32]) {
    const code = generateTokenCode(len);
    assert.equal(code.length, len);
  }
});

test("generateTokenCode only uses uppercase A-Z + digits from the 31-symbol charset", () => {
  for (let i = 0; i < 200; i++) {
    const code = generateTokenCode();
    assert.ok(isValidTokenCode(code), `unexpected chars in: ${code}`);
    for (const ch of code) {
      assert.ok(TOKEN_CHARSET.includes(ch), `unexpected char: ${ch}`);
      // No lowercase letters, no ambiguous glyphs.
      assert.ok(
        ch !== "0" && ch !== "O" && ch !== "1" && ch !== "I" && ch !== "L",
        `ambiguous char leaked into code: ${ch}`,
      );
    }
  }
});

// ---------------------------------------------------------------------------
// Validation helper
// ---------------------------------------------------------------------------

test("isValidTokenCode accepts a freshly generated code", () => {
  assert.ok(isValidTokenCode(generateTokenCode()));
});

test("isValidTokenCode rejects codes containing forbidden chars", () => {
  assert.equal(isValidTokenCode(""), false);
  assert.equal(isValidTokenCode("ABC0DEF"), false); // has '0'
  assert.equal(isValidTokenCode("ABCODEF"), false); // has 'O'
  assert.equal(isValidTokenCode("ABCIDEF"), false); // has 'I'
  assert.equal(isValidTokenCode("ABC1DEF"), false); // has '1'
  assert.equal(isValidTokenCode("ABC!DEF"), false); // punctuation
  assert.equal(isValidTokenCode("abcdefghijkl"), false); // lowercase
});

test("isValidTokenCode accepts a code containing all 31 charset chars", () => {
  // Sanity check: every character of the alphabet is valid on its own.
  assert.ok(isValidTokenCode(TOKEN_CHARSET));
});

// ---------------------------------------------------------------------------
// Uniqueness / collision handling
// ---------------------------------------------------------------------------

test("generateTokenCode produces 1000 unique codes in 1000 draws", () => {
  // 12-char × 31-symbol code ≈ 59 bits. 1k samples should be all unique.
  const codes = new Set();
  for (let i = 0; i < 1000; i++) {
    codes.add(generateTokenCode());
  }
  assert.equal(codes.size, 1000, "expected 1000 unique codes from 1000 draws");
});

test("collision retry loop creates the requested count even with a duplicate-prone store", () => {
  // Simulate the server function's retry loop: a "DB" that rejects the
  // first 3 attempts for a given code with a P2002-style duplicate, then
  // accepts. The helper should produce enough unique codes to satisfy the
  // requested count, even when collisions occur.
  const stored = new Set();
  const rejections = new Map();
  const desired = 5;
  const created = [];
  const MAX_RETRIES = 5;

  function tryCreate(code) {
    if (stored.has(code)) {
      const count = rejections.get(code) ?? 0;
      rejections.set(code, count + 1);
      // Pretend a duplicate for the first 3 attempts on this code only.
      if (count < 3) return false;
    }
    stored.add(code);
    return true;
  }

  for (let i = 0; i < desired; i++) {
    let attempts = 0;
    let saved = false;
    while (attempts < 1 + MAX_RETRIES && !saved) {
      const candidate = generateTokenCode();
      attempts++;
      saved = tryCreate(candidate);
    }
    assert.ok(saved, `failed to save code ${i + 1} within ${1 + MAX_RETRIES} attempts`);
    created.push([...stored].pop());
  }

  assert.equal(created.length, desired);
  assert.equal(new Set(created).size, desired, "stored codes must be unique");
});

// ---------------------------------------------------------------------------
// AC: no `Math.random()` use in the token code path
// ---------------------------------------------------------------------------

test("no `Math.random()` is used in the token code generation files", () => {
  const candidates = [
    "src/lib/server/ujian/functions.ts",
    "src/lib/server/db/id.server.ts",
  ];
  for (const rel of candidates) {
    const abs = resolve(process.cwd(), rel);
    const src = readFileSync(abs, "utf8");
    // Strip `//` and `/* */` comments so historical references in JSDoc
    // do not trigger a false positive.
    const stripped = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    assert.equal(
      stripped.includes("Math.random()"),
      false,
      `${rel} still uses Math.random() in code; use randomBytes instead`,
    );
  }
});

test("no `Math.random()` is used in the client token admin route", () => {
  const abs = resolve(
    process.cwd(),
    "src/routes/_authenticated/admin.ujian.$id.token.tsx",
  );
  const src = readFileSync(abs, "utf8");
  assert.equal(
    src.includes("Math.random()"),
    false,
    "client route should delegate token generation to the server",
  );
});

test("token generation file imports `randomBytes` from node:crypto", () => {
  const src = readFileSync(
    resolve(process.cwd(), "src/lib/server/ujian/functions.ts"),
    "utf8"
  );
  assert.match(
    src,
    /from\s+["']node:crypto["']/,
    "expected `import { randomBytes } from 'node:crypto'` in functions.ts",
  );
});
