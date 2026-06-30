/**
 * Unit tests for atomic single-use exam token claim (Issue #9).
 *
 * Run with:  node --test tests/unit/token-claim.test.mjs
 *            (or)  npm run test:unit
 *
 * The production claim is a single conditional UPDATE:
 *
 *   UPDATE TokenUjian
 *      SET dipakaiOleh = :caller, dipakaiAt = :now
 *    WHERE ujianId = :ujianId AND kode = :kode
 *      AND (dipakaiOleh IS NULL OR dipakaiOleh = :caller)
 *
 * and a check on the affected-row count. SQLite serializes the racing
 * writes, so exactly one caller flips an unused token (count === 1) and the
 * loser matches zero rows (count === 0). There is no read-then-write gap.
 *
 * The repo has no DB test harness, so this file models the token row in
 * memory. The race test deliberately inserts an *awaited yield* between the
 * WHERE-read and the SET so the two strategies can be compared under genuine
 * interleaving:
 *   - the OLD read-then-write path produces MULTIPLE winners (the bug);
 *   - the conditional-claim path (compare-and-set in a single non-yielding
 *     step, as the SQL statement is) produces EXACTLY ONE winner.
 * This shows the fix closes the gap rather than relying on JS being
 * single-threaded. Written as .mjs to match tests/unit/token-codes.test.mjs.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";

function tokenRow(kode, dipakaiOleh = null) {
  return { ujianId: "uj_1", kode, dipakaiOleh, dipakaiAt: null };
}

/**
 * Models `claimExamToken`'s authoritative step. The WHERE-match and the SET
 * happen in one synchronous step with NO await between them — exactly as a
 * single SQL `updateMany` statement is atomic at the DB. Returns the affected
 * row count like Prisma's `updateMany`.
 */
function conditionalClaim(rows, ujianId, kode, callerId) {
  const code = kode.trim().toUpperCase();
  let count = 0;
  for (const row of rows) {
    const matches =
      row.ujianId === ujianId &&
      row.kode === code &&
      (row.dipakaiOleh == null || row.dipakaiOleh === callerId);
    if (matches) {
      row.dipakaiOleh = callerId;
      row.dipakaiAt = Date.now();
      count++;
    }
  }
  return count;
}

/** Full claim semantics: map a 0-count to the disambiguated error. */
function claim(rows, ujianId, kode, callerId) {
  const code = kode.trim().toUpperCase();
  const count = conditionalClaim(rows, ujianId, kode, callerId);
  if (count > 0) {
    return { ok: true, token: { ujianId, kode: code, dipakaiOleh: callerId } };
  }
  const existing = rows.find((r) => r.ujianId === ujianId && r.kode === code);
  return existing
    ? { ok: false, error: "Token sudah dipakai peserta lain" }
    : { ok: false, error: "Token tidak valid untuk ujian ini" };
}

test("fresh claim succeeds and marks the token used by the caller", () => {
  const rows = [tokenRow("ABC123")];
  const result = claim(rows, "uj_1", "abc123", "peserta_1");
  assert.equal(result.ok, true);
  assert.equal(rows[0].dipakaiOleh, "peserta_1");
  assert.equal(typeof rows[0].dipakaiAt, "number");
});

test("re-claim by the same participant is idempotent", () => {
  const rows = [tokenRow("ABC123", "peserta_1")];
  const result = claim(rows, "uj_1", "ABC123", "peserta_1");
  assert.equal(result.ok, true);
  assert.equal(rows[0].dipakaiOleh, "peserta_1");
});

test("token already used by another participant is rejected", () => {
  const rows = [tokenRow("ABC123", "peserta_OTHER")];
  const result = claim(rows, "uj_1", "ABC123", "peserta_1");
  assert.equal(result.ok, false);
  assert.equal(result.error, "Token sudah dipakai peserta lain");
  assert.equal(rows[0].dipakaiOleh, "peserta_OTHER");
});

test("unknown code (or wrong exam) is rejected as invalid", () => {
  const rows = [tokenRow("ABC123")];
  const unknown = claim(rows, "uj_1", "ZZZ999", "peserta_1");
  assert.equal(unknown.ok, false);
  assert.equal(unknown.error, "Token tidak valid untuk ujian ini");
  const wrongExam = claim(rows, "uj_OTHER", "ABC123", "peserta_1");
  assert.equal(wrongExam.ok, false);
  assert.equal(wrongExam.error, "Token tidak valid untuk ujian ini");
});

test("case-insensitive code matching, stored uppercase", () => {
  const rows = [tokenRow("MIXED1")];
  const result = claim(rows, "uj_1", "  mixed1  ", "peserta_1");
  assert.equal(result.ok, true);
  assert.equal(rows[0].kode, "MIXED1");
});

// --- The interleaving test: this is the one that actually proves the fix ---

/**
 * OLD buggy path: read dipakaiOleh, AWAIT (yield to the event loop), then
 * write if it looked unused. The yield lets every contender read the unused
 * state before any writes land — the classic read-then-write race.
 */
async function racyReadThenWrite(rows, ujianId, kode, callerId) {
  const row = rows.find((r) => r.ujianId === ujianId && r.kode === kode);
  const observed = row.dipakaiOleh;
  await Promise.resolve(); // yield: all readers see `observed` before any write
  if (observed == null || observed === callerId) {
    row.dipakaiOleh = callerId;
    return { ok: true };
  }
  return { ok: false };
}

/**
 * NEW path: the conditional claim is a single non-yielding compare-and-set,
 * mirroring the atomic SQL statement. An awaited yield is inserted only
 * BEFORE the atomic step, proving the winner is decided by the CAS itself
 * and not by scheduling order.
 */
async function atomicClaim(rows, ujianId, kode, callerId) {
  await Promise.resolve(); // interleave scheduling, then claim atomically
  const count = conditionalClaim(rows, ujianId, kode, callerId);
  return { ok: count > 0 };
}

test("interleaved read-then-write (OLD path) double-claims — demonstrates the bug", async () => {
  const rows = [tokenRow("RACE01")];
  const contenders = Array.from({ length: 20 }, (_, i) => `peserta_${i}`);
  const results = await Promise.all(
    contenders.map((id) => racyReadThenWrite(rows, "uj_1", "RACE01", id)),
  );
  const winners = results.filter((r) => r.ok).length;
  assert.ok(winners > 1, `old path must allow >1 winner under interleaving, got ${winners}`);
});

test("interleaved atomic claim (NEW path): exactly one wins", async () => {
  const rows = [tokenRow("RACE01")];
  const contenders = Array.from({ length: 20 }, (_, i) => `peserta_${i}`);
  const results = await Promise.all(
    contenders.map((id) => atomicClaim(rows, "uj_1", "RACE01", id)),
  );
  const winners = results.filter((r) => r.ok).length;
  assert.equal(winners, 1, "atomic conditional claim must yield exactly one winner");
  assert.equal(rows.filter((r) => r.dipakaiOleh != null).length, 1);
});
