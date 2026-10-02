import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { getExamAudienceMode } from "../../src/lib/cbt/exam-audience.ts";

const source = readFileSync(new URL("../../src/lib/server/ujian/functions.ts", import.meta.url), "utf8");
const body = source.slice(source.indexOf("async function validateExamAudience("), source.indexOf("async function getPublishError("));
const compiled = ts.transpile(body, { target: ts.ScriptTarget.ES2022 });
const validate = new Function("getExamAudienceMode", "prisma", `${compiled}; return validateExamAudience;`)(getExamAudienceMode, {});
const unit = (id, tipe) => ({ id, tipe });
const db = (units) => ({ unitAkademik: { findMany: async ({ where }) => units.filter((u) => where.id.in.includes(u.id)) } });

test("mode kelas accepts multiple classes", async () => {
  const units = [unit("a", "kelas"), unit("b", "kelas")];
  assert.equal(getExamAudienceMode(units), "kelas");
  await validate({ groupIds: ["a", "b"] }, db(units));
});

test("mode jurusan accepts jurusan and prodi together", async () => {
  const units = [unit("a", "jurusan"), unit("b", "prodi")];
  assert.equal(getExamAudienceMode(units), "jurusan");
  await validate({ groupIds: ["a", "b"] }, db(units));
});

test("server rejects a mixture of classes and departments", async () => {
  const units = [unit("a", "kelas"), unit("b", "jurusan")];
  assert.equal(getExamAudienceMode(units), null);
  await assert.rejects(validate({ groupIds: ["a", "b"] }, db(units)), /tidak boleh dicampur/);
});

test("server rejects faculty, semester, free category, and unknown IDs", async () => {
  for (const tipe of ["fakultas", "semester", "kategori_bebas"]) {
    await assert.rejects(validate({ groupIds: ["a"] }, db([unit("a", tipe)])), /tidak boleh dicampur/);
  }
  await assert.rejects(validate({ groupIds: ["missing"] }, db([])), /tidak boleh dicampur/);
});

test("empty groups remain valid for drafts and course membership", async () => {
  assert.equal(getExamAudienceMode([]), null);
  await validate({ groupIds: [] }, { unitAkademik: { findMany: () => assert.fail("Empty groups should not query units") } });
});

test("duplicate IDs do not create a second access mode", async () => {
  await validate({ groupIds: ["a", "a"] }, db([unit("a", "kelas")]));
});

test("malformed groups are rejected before querying", async () => {
  await assert.rejects(validate({ groupIds: null }, {}), /tidak valid/);
  await assert.rejects(validate({ groupIds: [42] }, {}), /tidak valid/);
});

test("save and publish both validate audience on the server", () => {
  const publish = source.slice(source.indexOf("async function getPublishError("), source.indexOf("export const mutateUjianServer"));
  assert.match(publish, /await validateExamAudience\(item, db\)/);
  assert.match(source, /validateUjianForSave\(item\);\s*await validateExamAudience\(item, tx\)/);
});

const mutationSource = source.slice(source.indexOf("export const mutateUjianServer"), source.indexOf("class ExamScheduleValidationError"));
const mutationCompiled = ts.transpile(mutationSource.replace("export const", "const"), { target: ts.ScriptTarget.ES2022 });
const createMutation = (prisma, role = "super_admin") => new Function(
  "createServerFn", "z", "prisma", "seedIfNeeded", "requireCaller", "audit", "validateExamAudience", "toBigInt", "stringifyJson", "operatorHasNav",
  `${mutationCompiled}; return mutateUjianServer;`,
)(
  () => ({ validator() { return this; }, handler(fn) { return fn; } }),
  { object: () => ({}), enum: () => ({}), any: () => ({}) },
  prisma, async () => {}, async () => ({ id: "admin", role }), async () => {}, validate,
  (value) => value === undefined ? null : BigInt(value), JSON.stringify, async () => true,
);

function bulkDatabase(units, failCreate = false) {
  const state = { rows: [{ id: "existing", status: "published", groupIds: '["legacy"]' }], writes: 0 };
  return { state, async $transaction(callback) {
    const rows = structuredClone(state.rows);
    const tx = { ...db(units), ujian: {
      deleteMany: async () => { state.writes++; rows.length = 0; },
      create: async ({ data }) => {
        state.writes++;
        if (failCreate && rows.length === 1) throw new Error("fixture write failure");
        rows.push(data);
      },
    } };
    await callback(tx);
    state.rows = rows;
  } };
}
const bulkItem = (id, groupIds, status = "draft") => ({ id, groupIds, status, topicSets: [], createdAt: 1 });

test("bulk rejects mixed and unknown audiences before any writes, preserving legacy published data", async () => {
  for (const invalid of [["class", "department"], ["missing"]]) {
    const database = bulkDatabase([unit("class", "kelas"), unit("department", "jurusan")]);
    const before = structuredClone(database.state.rows);
    const result = await createMutation(database)({ data: { action: "bulkSet", payload: [bulkItem("valid", ["class"]), bulkItem("invalid", invalid, "published")] } });
    assert.equal(result.ok, false);
    assert.match(result.error, /tidak boleh dicampur/);
    assert.equal(database.state.writes, 0);
    assert.deepEqual(database.state.rows, before);
  }
});

test("bulk accepts homogeneous audiences and preserves imported published status", async () => {
  const database = bulkDatabase([unit("class", "kelas"), unit("department", "jurusan"), unit("program", "prodi")]);
  const result = await createMutation(database)({ data: { action: "bulkSet", payload: [bulkItem("classes", ["class"]), bulkItem("departments", ["department", "program"], "published")] } });
  assert.equal(result.ok, true);
  assert.equal(database.state.rows[1].status, "published");
  assert.equal(database.state.rows[1].groupIds, '["department","program"]');
});

test("bulk transaction rolls back a later write failure", async () => {
  const database = bulkDatabase([unit("class", "kelas")], true);
  const before = structuredClone(database.state.rows);
  const result = await createMutation(database)({ data: { action: "bulkSet", payload: [bulkItem("first", ["class"]), bulkItem("second", ["class"])] } });
  assert.equal(result.ok, false);
  assert.deepEqual(database.state.rows, before);
});

test("bulk remains forbidden to scoped operators without writes", async () => {
  const database = bulkDatabase([]);
  const result = await createMutation(database, "admin_prodi")({ data: { action: "bulkSet", payload: [] } });
  assert.equal(result.error, "Forbidden");
  assert.equal(database.state.writes, 0);
});

test("editor blocks legacy mixed selections until a mode is chosen", () => {
  const editor = readFileSync(new URL("../../src/routes/_authenticated/admin.ujian.$id.tsx", import.meta.url), "utf8");
  assert.match(editor, /type="radio" name="audience-mode"/);
  assert.match(editor, /checked=\{!invalidAudience && audienceMode === mode.value\}/);
  assert.match(editor, /set\("groupIds", selectedGroups.filter/);
  assert.equal((editor.match(/if \(invalidAudience\)/g) ?? []).length, 2);
  assert.match(editor, /fieldset className="space-y-2" disabled=\{locked\}/);
});
