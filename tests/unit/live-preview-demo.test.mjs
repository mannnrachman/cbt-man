import assert from "node:assert/strict";
import { test } from "node:test";
import { createLivePreviewExam, createSeedDataset } from "../../src/lib/server/db/seed-shared.mjs";

test("live preview uses actual topic counts and includes every question type", () => {
  const soal = [
    { id: "1", topikId: "a", tipe: "pg" },
    { id: "2", topikId: "a", tipe: "multi" },
    { id: "3", topikId: "b", tipe: "bs" },
    { id: "4", topikId: "b", tipe: "essay" },
  ];
  const exam = createLivePreviewExam({ soal, groupIds: ["unit"], createdBy: "admin", now: 1000 });
  assert.deepEqual(exam.topicSets.map((t) => t.jumlah), [2, 2]);
  assert.equal(exam.beginAt, undefined);
  assert.equal(exam.endAt, undefined);
  assert.equal(exam.tokenAktif, false);
  assert.equal(exam.allowCalculator, true);
  assert.equal(exam.allowNilaiNormal, true);
  assert.equal(exam.fullscreenWajib, false);
  assert.equal(exam.blokirShortcut, false);
  assert.throws(() => createLivePreviewExam({ soal: soal.slice(1), groupIds: ["unit"], createdBy: "admin" }), /pg/);
  assert.throws(() => createLivePreviewExam({ soal, groupIds: [], createdBy: "admin" }), /peserta/);
});

test("development seed includes a playable live preview for every demo participant", async () => {
  let id = 0;
  const dataset = await createSeedDataset({ uid: (prefix) => `${prefix}${++id}`, now: 1000, hashPassword: async () => "hash" });
  const exam = dataset.ujian.find((e) => e.id === "ex_demo_live_preview");
  assert.ok(exam);
  for (const participant of dataset.users.filter((u) => u.role === "mahasiswa")) {
    assert.ok(exam.groupIds.includes(participant.unitId));
  }
  for (const topic of exam.topicSets) {
    assert.equal(topic.jumlah, dataset.soal.filter((s) => s.topikId === topic.topikId).length);
  }
  assert.equal(dataset.sesi.filter((s) => s.ujianId === exam.id).length, 0);
});
