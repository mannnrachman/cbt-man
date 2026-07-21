/**
 * Contract regression tests for the CBT snapshot lockdown (Issue #1).
 *
 * Run with:  node --test tests/unit/snapshot-lockdown.test.mjs
 *            (or)  npm run test:unit
 *
 * The pre-login data leak (passwordHash/tokens/sessions reaching anonymous
 * clients) is already fixed in production code:
 *   - `getCbtSnapshot` requires a valid session (fails closed).
 *   - `publicUser` strips `passwordHash` to "".
 *   - `/` loads public boot config; `/login` redirects to that public route.
 *   - Neither public route calls `hydrateRepos`.
 *
 * These structural/contract tests PIN those invariants so a future refactor
 * cannot silently re-open the leak. They are intentionally source-grep based
 * (no DOM/server runtime needed), mirroring the GH-11 sink-inventory test
 * convention in tests/unit/rich-text-sanitize.test.mjs.
 */

import { strict as assert } from "node:assert";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { test } from "node:test";

function read(rel) {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

// Recursively collect every .ts/.tsx file under a directory.
function walk(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) walk(abs, acc);
    else if (/\.(ts|tsx)$/.test(entry.name)) acc.push(abs);
  }
  return acc;
}

test("every hydrateRepos caller in src/routes is under an _authenticated segment", () => {
  const root = resolve(process.cwd(), "src/routes");
  const offenders = [];
  for (const abs of walk(root)) {
    // Match the actual call/import, not the word inside a comment/string.
    if (/\bhydrateRepos\b/.test(readFileSync(abs, "utf8"))) {
      const rel = abs.slice(process.cwd().length + 1);
      // Path must contain an `_authenticated` segment (file or directory).
      if (!rel.split("/").some((seg) => seg.startsWith("_authenticated"))) {
        offenders.push(rel);
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `hydrateRepos must only be called from authenticated routes; offenders: ${offenders.join(", ")}`,
  );
});

test("landing route boots via loadPublicBootConfig and never hydrateRepos", () => {
  const src = read("src/routes/index.tsx");
  assert.ok(/loadPublicBootConfig/.test(src), "index.tsx must use loadPublicBootConfig");
  assert.ok(
    !/\bhydrateRepos\b/.test(src),
    "index.tsx must NOT call hydrateRepos (anonymous full-snapshot leak)",
  );
});

test("login route redirects anonymous users to the public landing route", () => {
  const src = read("src/routes/login.tsx");
  assert.match(
    src,
    /throw redirect\(\{\s*to:\s*"\/",\s*search:\s*\{\s*login:\s*true,\s*redirect:\s*search\.redirect,/s,
    "login.tsx must redirect anonymous users to the landing-page login modal",
  );
  assert.ok(
    !/\bhydrateRepos\b/.test(src),
    "login.tsx must NOT call hydrateRepos (anonymous full-snapshot leak)",
  );
});

test("login modal only follows same-origin redirect URLs", () => {
  const src = read("src/components/LoginModal.tsx");
  assert.match(src, /redirectUrl\?\.startsWith\("\/"\)/, "redirect must be root-relative");
  assert.match(
    src,
    /redirect\?\.origin === window\.location\.origin/,
    "redirect must remain on the current origin",
  );
});

test("publicUser projection strips passwordHash to an empty string", () => {
  const src = read("src/lib/server/repos/mappers.ts");
  // Locate the publicUser function body and assert it forces passwordHash: "".
  const fnIdx = src.indexOf("function publicUser(");
  assert.ok(fnIdx > 0, "publicUser function must exist");
  const body = src.slice(fnIdx, fnIdx + 200);
  assert.ok(
    /passwordHash:\s*""/.test(body),
    `publicUser must set passwordHash to "" — body was: ${body}`,
  );
});

test("getCbtSnapshot fails closed without a session", () => {
  const serverFunctionsCode = read("src/lib/server/snapshot/functions.ts");
  const fnIdx = serverFunctionsCode.indexOf("export const getCbtSnapshot");
  assert.ok(fnIdx > 0, "getCbtSnapshot must exist");
  const body = serverFunctionsCode.slice(fnIdx, fnIdx + 320);
  // Must validate a session and throw/deny when there is no caller.
  assert.ok(
    /requireCaller\(\)/.test(body),
    "getCbtSnapshot body must call requireCaller",
  );
  assert.ok(
    /if\s*\(!caller\)/.test(body) && /throw/.test(body),
    "must fail closed when unauthenticated",
  );
});

test("public boot config type exposes only non-sensitive branding fields", () => {
  const src = read("src/lib/server/repos/mappers.ts");
  // The PublicBootConfig type must be a Pick limited to branding fields and
  // must not include sensitive collections.
  const typeIdx = src.indexOf("export type PublicBootConfig");
  assert.ok(typeIdx > 0, "PublicBootConfig type must exist");
  const decl = src.slice(typeIdx, src.indexOf(";", typeIdx) + 1);
  for (const field of ["appName", "appDeskripsi", "pesanLogin"]) {
    assert.ok(decl.includes(field), `PublicBootConfig must expose ${field}`);
  }
  for (const leak of ["users", "token", "sesi", "passwordHash", "soal"]) {
    assert.ok(!decl.includes(leak), `PublicBootConfig must NOT expose ${leak}`);
  }
});
