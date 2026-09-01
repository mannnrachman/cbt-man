import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parseOperatorScope, resolveOperatorScopes, requestedUjianScopeAllowed } from "../../src/lib/cbt/ujian-scope.ts";
import { compareAndSetMembership } from "../../src/lib/cbt/penawaran-membership.ts";

function read(rel) {
  return readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");
}

test("exam lifecycle has additive draft/published persistence", () => {
  const schema = read("prisma/schema.prisma");
  const migration = read("prisma/migrations/20260823100000_add_ujian_lifecycle/migration.sql");
  const types = read("src/lib/cbt/types.ts");

  assert.match(schema, /enum StatusUjian \{[\s\S]*draft[\s\S]*published/);
  assert.match(schema, /status\s+StatusUjian\s+@default\(draft\)/);
  assert.match(migration, /ADD COLUMN "status" TEXT NOT NULL DEFAULT 'draft'/);
  assert.match(migration, /UPDATE "Ujian" SET "status" = 'published'/);
  assert.match(types, /StatusUjianEnum = z\.enum\(\["draft", "published"\]\)/);
});

test("only published exams with explicit groups enter the participant snapshot", () => {
  const snapshot = read("src/lib/server/repos/snapshot.ts");
  const start = snapshot.indexOf("export function pesertaSnapshot(");
  const end = snapshot.indexOf("export async function buildSnapshotForUser", start);
  const body = snapshot.slice(start, end);

  assert.match(body, /item\.status === "published"/);
  assert.match(body, /offering\?\.pesertaIds\.includes\(caller\.id\)/);
  assert.match(body, /soalSnapshot: \[\]/);
});

test("publish performs readiness checks before changing status", () => {
  const server = read("src/lib/server/ujian/functions.ts");
  assert.match(server, /action: z\.enum\(\["upsert", "remove", "bulkSet", "publish"\]\)/);
  assert.match(server, /if \(item\.topicSets\.length === 0\)/);
  assert.match(server, /if \(item\.groupIds\.length === 0 && parseJson/);
  assert.match(server, /if \(!item\.penawaranId\)/);
  assert.match(server, /if \(item\.beginAt === undefined \|\| item\.endAt === undefined\)/);
  assert.match(server, /topikMataKuliahId !== item\.mataKuliahId/);
  assert.match(server, /status: "published"/);
});

test("server refuses session creation for draft exams", () => {
  const server = read("src/lib/server/sesi/functions.ts");
  assert.match(server, /ujian\.status !== "published"/);
  assert.match(server, /sourceTopikIds\.has\(ts\.topikId\)/);
});

test("one participant can have only one session per exam", () => {
  const schema = read("prisma/schema.prisma");
  const migration = read("prisma/migrations/20260823104500_unique_exam_participant_session/migration.sql");
  const server = read("src/lib/server/sesi/functions.ts");
  assert.match(schema, /@@unique\(\[ujianId, pesertaId\]\)/);
  assert.match(migration, /CREATE UNIQUE INDEX/);
  assert.match(server, /ujianId_pesertaId/);
});

test("TokenClaim is the canonical token access check", () => {
  const session = read("src/lib/server/sesi/functions.ts");
  const participant = read("src/routes/_authenticated/peserta.ujian.$id.index.tsx");
  const migration = read("prisma/migrations/20260823104500_unique_exam_participant_session/migration.sql");
  assert.match(session, /prisma\.tokenClaim\.findUnique/);
  assert.doesNotMatch(session, /where: \{ ujianId: ujian\.id, dipakaiOleh: caller\.id \}/);
  assert.doesNotMatch(participant, /tokenRow\?\.dipakaiOleh/);
  assert.match(migration, /INSERT OR IGNORE INTO "TokenClaim"/);
});

test("session mutations use the existing session scope and restrict evaluators", () => {
  const server = read("src/lib/server/sesi/functions.ts");
  assert.match(server, /Evaluator hanya dapat memperbarui penilaian/);
  assert.match(server, /Sesi belum selesai untuk dievaluasi/);
  assert.match(server, /where: \{ id: String\(\(payload as SesiUjian\)\.id/);
});

test("course offerings are additive and legacy exams receive a compatibility offering", () => {
  const schema = read("prisma/schema.prisma");
  const migration = read("prisma/migrations/20260824100000_add_penawaran_mata_kuliah/migration.sql");
  const types = read("src/lib/cbt/types.ts");
  assert.match(schema, /model PenawaranMataKuliah/);
  assert.match(schema, /penawaranId\s+String\?/);
  assert.match(migration, /CREATE TABLE "PenawaranMataKuliah"/);
  assert.match(migration, /po_legacy_/);
  assert.match(types, /penawaranId: z\.string\(\)\.optional\(\)/);
});

test("operator updates authorize both stored and requested exam scope", () => {
  const server = read("src/lib/server/ujian/functions.ts");
  const auth = read("src/lib/server/db/auth.ts");
  assert.match(server, /if \(action === "bulkSet"\) return \{ ok: false as const, error: "Forbidden" \}/);
  assert.match(server, /existing && !\(await operatorCanTouchUjian\(caller, item\.id\)\)/);
  assert.match(server, /operatorCanTouchUjianInput\(caller, item\)/);
  assert.match(auth, /requestedUjianScopeAllowed/);
  assert.match(auth, /penawaranMataKuliah\.findUnique/);

  const allowed = new Set(["mk_allowed"]);
  const check = (overrides = {}) =>
    requestedUjianScopeAllowed({
      unrestricted: false,
      topicsPresent: false,
      topicsAllowed: true,
      allowedMataKuliahIds: allowed,
      penawaranRequested: false,
      ...overrides,
    });
  assert.equal(check(), false, "a restricted empty draft has no authorized scope");
  assert.equal(check({ mataKuliahId: "mk_foreign" }), false, "foreign requested/stored course is rejected");
  assert.equal(check({ mataKuliahId: "mk_allowed" }), true);
  assert.equal(
    check({ penawaranRequested: true, penawaranMataKuliahId: "mk_foreign" }),
    false,
    "foreign offering is rejected",
  );
});

test("operator scope parsing fails closed for malformed or non-string arrays", () => {
  assert.deepEqual(parseOperatorScope("[]"), []);
  assert.deepEqual(parseOperatorScope('["mk_1"]'), ["mk_1"]);
  assert.equal(parseOperatorScope("{"), null);
  assert.equal(parseOperatorScope('{"id":"mk_1"}'), null);
  assert.equal(parseOperatorScope('"mk_1"'), null);
  assert.equal(parseOperatorScope('["mk_1", 2]'), null);

  assert.deepEqual(resolveOperatorScopes("[]", "[]"), { status: "unrestricted" });
  assert.deepEqual(resolveOperatorScopes('["t1"]', '["mk_1"]'), {
    status: "scoped",
    topikIds: ["t1"],
    mataKuliahIds: ["mk_1"],
  });
  // Either field malformed → deny both (no partial course fallback).
  assert.deepEqual(resolveOperatorScopes("{", '["mk_1"]'), { status: "denied" });
  assert.deepEqual(resolveOperatorScopes('["t1"]', "{"), { status: "denied" });
  assert.deepEqual(resolveOperatorScopes('{"id":"t1"}', "[]"), { status: "denied" });
  assert.deepEqual(resolveOperatorScopes("[]", '["mk_1", 2]'), { status: "denied" });

  const auth = read("src/lib/server/db/auth.ts");
  assert.match(auth, /resolveOperatorScopes\(caller\.allowedTopikIds, caller\.mataKuliahIds\)/);
  assert.match(auth, /if \(scope\.status === "denied"\) return false/);
  assert.match(auth, /if \(scope\.status === "denied"\) return new Set\(\)/);

  const snapshot = read("src/lib/server/repos/snapshot.ts");
  assert.match(snapshot, /resolveOperatorScopes\(caller\.allowedTopikIds, caller\.mataKuliahIds\)/);
  assert.match(snapshot, /scope\.status === "scoped" \? scope\.topikIds : \[\]/);
  assert.match(snapshot, /scope\.status === "scoped" \? scope\.mataKuliahIds : \[\]/);
});

test("offering membership writes are serialized and reject stale state", async () => {
  const client = read("src/lib/cbt/repos.ts");
  const server = read("src/lib/server/akademik/functions.ts");
  assert.match(client, /penawaranMembershipPending\.then\(request, request\)/);
  assert.match(client, /upsertArrayItem\(cache\.penawaran, result\.penawaran\)/);
  assert.match(server, /expectedPengampuIds/);
  assert.match(server, /penawaranMataKuliah\.updateMany/);
  assert.match(server, /compareAndSetMembership/);

  let reads = 0;
  const stale = await compareAndSetMembership(
    async () => 0,
    async () => {
      reads++;
      return { id: "po_1" };
    },
  );
  assert.equal(stale, null);
  assert.equal(reads, 0, "stale writes must not reconcile an unaccepted state");
  assert.deepEqual(
    await compareAndSetMembership(async () => 1, async () => ({ id: "po_1" })),
    { id: "po_1" },
  );
});
