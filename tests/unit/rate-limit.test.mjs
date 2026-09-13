import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function read(rel) {
  return readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");
}

test("login throttle matches the five-failure policy", () => {
  const limiter = read("src/lib/cbt/rate-limit.ts");
  assert.match(limiter, /const MAX_ATTEMPTS = 5;/);
  assert.doesNotMatch(limiter, /const MAX_ATTEMPTS = 15;/);
  assert.match(limiter, /export function recordRateLimit/);
  assert.match(limiter, /options\?: \{ record\?: boolean \}/);
});

test("login records only after authentication fails and clears on success", () => {
  const auth = read("src/lib/server/auth/functions.ts");
  assert.match(auth, /checkRateLimit\(ip, "login:ip", \{ record: false \}\)/);
  assert.match(auth, /checkRateLimit\(username, "login:user", \{ record: false \}\)/);
  assert.match(auth, /recordRateLimit\(ip, "login:ip"\)/);
  assert.match(auth, /recordRateLimit\(username, "login:user"\)/);
  assert.match(auth, /clearRateLimit\(ip, "login:ip"\)/);
  assert.match(auth, /clearRateLimit\(username, "login:user"\)/);
  assert.doesNotMatch(auth, /checkRateLimit\(ip, "login:ip"\)\s*;/);
});
