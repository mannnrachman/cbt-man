import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { armExamAlarm, startExamAlarm, stopExamAlarm } from "../../src/lib/cbt/exam-alarm.ts";

function read(rel) {
  return readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");
}

test("kerjakan registers leave-surface listeners while the session is sedang", () => {
  const src = read("src/routes/_authenticated/peserta.ujian.$id.kerjakan.tsx");
  assert.match(src, /activeSesiStatus !== "sedang"/);
  assert.match(src, /document\.hidden/);
  assert.match(src, /addEventListener\("visibilitychange"/);
  assert.match(src, /removeEventListener\("visibilitychange"/);
  assert.match(src, /addEventListener\("blur"/);
  assert.match(src, /removeEventListener\("blur"/);
  assert.match(src, /role="dialog"/);
  assert.match(src, /reportExamViolation/);
  assert.match(src, /leaveQuietUntilRef/);
  assert.match(src, /Sesi ujian dikunci/);
  assert.match(src, /stopExamAlarm\(\)/);
});

test("exam alarm auto-stops after three seconds and supports explicit cleanup", () => {
  const originalWindow = globalThis.window;
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const timers = new Map();
  let nextTimerId = 1;
  const oscillators = [];
  const gains = [];

  class FakeAudioContext {
    state = "running";
    destination = {};
    createOscillator() {
      const oscillator = {
        type: "sine",
        frequency: { value: 0 },
        stopped: 0,
        disconnected: 0,
        connect() {},
        start() {},
        stop() {
          this.stopped += 1;
        },
        disconnect() {
          this.disconnected += 1;
        },
      };
      oscillators.push(oscillator);
      return oscillator;
    }
    createGain() {
      const gain = { gain: { value: 0 }, connect() {} };
      gains.push(gain);
      return gain;
    }
    resume() {
      return Promise.resolve();
    }
  }

  globalThis.window = { AudioContext: FakeAudioContext };
  globalThis.setTimeout = (callback, delay) => {
    const id = nextTimerId++;
    timers.set(id, { callback, delay });
    return id;
  };
  globalThis.clearTimeout = (id) => timers.delete(id);

  try {
    armExamAlarm();
    startExamAlarm();
    assert.equal(oscillators.length, 1);
    assert.equal(gains[0].gain.value, 0.06);
    assert.equal(timers.size, 1);
    const [timerId, timer] = timers.entries().next().value;
    assert.equal(timer.delay, 3000);
    timers.delete(timerId);
    timer.callback();
    assert.equal(oscillators[0].stopped, 1);
    assert.equal(oscillators[0].disconnected, 1);
    assert.equal(timers.size, 0);

    startExamAlarm(0);
    assert.equal(oscillators.length, 2);
    stopExamAlarm();
    assert.equal(oscillators[1].stopped, 1);
    assert.equal(oscillators[1].disconnected, 1);
    assert.equal(timers.size, 0);
  } finally {
    stopExamAlarm();
    globalThis.window = originalWindow;
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
});

test("reportExamViolation requires the caller and revokes sessions on lock", () => {
  const server = read("src/lib/server/sesi/functions.ts");
  const start = server.indexOf("export const reportExamViolation");
  assert.ok(start >= 0, "reportExamViolation must exist");
  const body = server.slice(start, start + 2800);

  assert.match(body, /requireCaller\(\)/);
  assert.match(body, /requireAuditLog\(/);
  assert.match(body, /caller\.role !== "mahasiswa"/);
  assert.match(body, /deleteSessionsForUser\(caller\.id\)/);
  assert.match(body, /closeSedangSesiWithServerGrade/);
  assert.match(body, /maxPindahTab === 0 \|\| pelanggaran > maxPindahTab/);
  assert.match(body, /sesi\.examViolation/);
  assert.doesNotMatch(body, /clipboard|jawabanEssay|jawabanIds/);

  assert.match(server, /async function closeSedangSesiWithServerGrade/);
  assert.match(server, /gradeSesiServerSide\(mapSesi\(row\)\)/);
});
