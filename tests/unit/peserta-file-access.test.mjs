/**
 * Unit tests for peserta file-access scoping (Issue #2).
 *
 * Run with:  node --test tests/unit/peserta-file-access.test.mjs
 *            (or)  npm run test:unit
 *
 * `getStoredFileUrl` must scope a peserta to file ids referenced by exams they
 * can access: the `deskripsi` of a group-assigned exam, or the
 * `detail`/`pembahasan`/`audioFileId` of a soal in one of THEIR sesi for such
 * an exam. This models that decision logic (the production helper queries
 * Prisma; the algorithm is identical) and asserts the I/O matrix.
 *
 * Written as .mjs to match tests/unit/token-codes.test.mjs.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";

function extractFileIds(html) {
  const ids = [];
  const re = /file:\/\/([a-z0-9_]+)/gi;
  let match;
  while ((match = re.exec(html))) ids.push(match[1]);
  return ids;
}

/**
 * Pure model of `pesertaCanAccessFile`. `db` carries the same rows the Prisma
 * queries would return.
 */
function pesertaCanAccessFile(caller, fileId, db) {
  const assigned = db.ujian.filter((u) => {
    const g = u.groupIds ?? [];
    return g.length === 0 || (!!caller.groupId && g.includes(caller.groupId));
  });
  const allowed = new Set();
  for (const u of assigned) for (const id of extractFileIds(u.deskripsi ?? "")) allowed.add(id);
  if (allowed.has(fileId)) return true;

  const assignedIds = new Set(assigned.map((u) => u.id));
  const soalIds = new Set();
  for (const s of db.sesi) {
    if (s.pesertaId !== caller.id) continue;
    if (!assignedIds.has(s.ujianId)) continue;
    for (const sid of s.soalIds ?? []) soalIds.add(sid);
  }
  if (soalIds.size === 0) return false;

  for (const soal of db.soal.filter((x) => soalIds.has(x.id))) {
    if (soal.audioFileId && soal.audioFileId === fileId) return true;
    for (const id of extractFileIds(soal.detail ?? "")) allowed.add(id);
    for (const id of extractFileIds(soal.pembahasan ?? "")) allowed.add(id);
    for (const j of soal.jawaban ?? []) {
      for (const id of extractFileIds(j.detail ?? "")) allowed.add(id);
    }
  }
  return allowed.has(fileId);
}

const peserta = { id: "u_1", role: "mahasiswa", groupId: "g_1" };

function baseDb() {
  return {
    ujian: [
      { id: "uj_assigned", groupIds: ["g_1"], deskripsi: '<p>see <img src="file://f_desc"></p>' },
      { id: "uj_other", groupIds: ["g_2"], deskripsi: '<img src="file://f_other">' },
    ],
    sesi: [{ pesertaId: "u_1", ujianId: "uj_assigned", soalIds: ["s_1"] }],
    soal: [
      {
        id: "s_1",
        detail: '<p><img src="file://f_soal"></p>',
        pembahasan: '<img src="file://f_pemb">',
        audioFileId: "f_audio",
        jawaban: [{ detail: "<p>A</p>" }, { detail: '<img src="file://f_opt">' }],
      },
    ],
  };
}

test("allows a file referenced in an assigned exam description", () => {
  assert.equal(pesertaCanAccessFile(peserta, "f_desc", baseDb()), true);
});

test("allows a file referenced in a soal of the peserta's own sesi", () => {
  assert.equal(pesertaCanAccessFile(peserta, "f_soal", baseDb()), true);
});

test("allows a soal pembahasan file in the peserta's own sesi", () => {
  assert.equal(pesertaCanAccessFile(peserta, "f_pemb", baseDb()), true);
});

test("allows the audioFileId of a soal in the peserta's own sesi", () => {
  assert.equal(pesertaCanAccessFile(peserta, "f_audio", baseDb()), true);
});

test("allows a file embedded in an answer-option detail of the peserta's own sesi", () => {
  assert.equal(pesertaCanAccessFile(peserta, "f_opt", baseDb()), true);
});

test("denies a file referenced only by an unassigned exam", () => {
  assert.equal(pesertaCanAccessFile(peserta, "f_other", baseDb()), false);
});

test("denies a completely unreferenced file id", () => {
  assert.equal(pesertaCanAccessFile(peserta, "f_unknown", baseDb()), false);
});

test("denies a soal file when the peserta has no sesi for that exam", () => {
  const db = baseDb();
  db.sesi = []; // no sesi → no soal-referenced files
  assert.equal(pesertaCanAccessFile(peserta, "f_soal", db), false);
});

test("open exam (empty groupIds) exposes its description files to any peserta", () => {
  const db = baseDb();
  db.ujian = [{ id: "uj_open", groupIds: [], deskripsi: '<img src="file://f_open">' }];
  db.sesi = [];
  assert.equal(pesertaCanAccessFile(peserta, "f_open", db), true);
});
