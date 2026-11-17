import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  SESSION_STATES,
  canTransitionSession,
  isSessionActive,
  isSessionFinished,
  isSessionTerminal,
  isSessionResumable,
  EXAM_STATES,
  canTransitionExam,
  isExamEditableInEditor,
  getExamAvailabilityStatus,
  isExamStartable,
  participantExamView,
  participantExamViewTone,
  PARTICIPANT_EXAM_VIEW_LABELS,
  tokenState,
  isTokenClaimableBy,
  canRevealResult,
  examScreenPhase,
  nextSaveTracker,
  SAVE_INITIAL,
  SAVE_STATE_LABELS,
  authPhaseOfUser,
  AUTH_INITIAL_PHASE,
  nextRequestState,
} from "../../src/lib/cbt/state-machines.ts";

const NOW = 1_800_000_000_000; // fixed epoch for deterministic window tests

test("session lifecycle declares exactly the persisted states and legal transitions", () => {
  assert.deepEqual([...SESSION_STATES], ["belum", "sedang", "selesai", "kedaluwarsa"]);
  assert.equal(canTransitionSession("belum", "sedang"), true, "start");
  assert.equal(canTransitionSession("sedang", "selesai"), true, "submit/force/timeout/lock");
  assert.equal(canTransitionSession("selesai", "selesai"), true, "terminal idempotent re-grade");
  assert.equal(canTransitionSession("selesai", "sedang"), false, "finished session cannot reopen");
  assert.equal(canTransitionSession("selesai", "belum"), false);
  assert.equal(canTransitionSession("sedang", "belum"), false);
  assert.equal(canTransitionSession("belum", "selesai"), false);
  assert.equal(isSessionActive("sedang"), true);
  assert.equal(isSessionActive("selesai"), false);
  assert.equal(isSessionFinished("selesai"), true);
  assert.equal(isSessionTerminal("selesai"), true);
  assert.equal(isSessionTerminal("kedaluwarsa"), true, "reserved state treated as terminal");
  assert.equal(isSessionTerminal("sedang"), false);
});

test("a running session is resumable only while session and exam windows are open", () => {
  const ujian = { endAt: undefined };
  assert.equal(isSessionResumable({ status: "sedang", endsAt: NOW + 60_000 }, ujian, NOW), true);
  assert.equal(isSessionResumable({ status: "sedang", endsAt: NOW - 1 }, ujian, NOW), false, "session deadline passed");
  assert.equal(isSessionResumable({ status: "sedang", endsAt: undefined }, ujian, NOW), false, "no session deadline");
  assert.equal(isSessionResumable({ status: "selesai", endsAt: NOW + 60_000 }, ujian, NOW), false);
  assert.equal(
    isSessionResumable({ status: "sedang", endsAt: NOW + 60_000 }, { endAt: NOW - 1 }, NOW),
    false,
    "exam window closed",
  );
  assert.equal(
    isSessionResumable({ status: "sedang", endsAt: NOW + 60_000 }, { endAt: NOW + 60_000 }, NOW),
    true,
  );
});

test("exam lifecycle is draft -> published and published locks the editor", () => {
  assert.deepEqual([...EXAM_STATES], ["draft", "published"]);
  assert.equal(canTransitionExam("draft", "published"), true);
  assert.equal(canTransitionExam("draft", "draft"), true);
  assert.equal(canTransitionExam("published", "published"), true);
  assert.equal(canTransitionExam("published", "draft"), false, "published is terminal for edits");
  assert.equal(isExamEditableInEditor("draft", false), true);
  assert.equal(isExamEditableInEditor("draft", true), false, "sessions exist -> locked");
  assert.equal(isExamEditableInEditor("published", false), false);
});

test("exam availability machine covers open/upcoming/active/ended", () => {
  assert.equal(getExamAvailabilityStatus({}, NOW), "open");
  assert.equal(getExamAvailabilityStatus({ beginAt: NOW + 1000 }, NOW), "upcoming");
  assert.equal(getExamAvailabilityStatus({ endAt: NOW - 1000 }, NOW), "ended");
  assert.equal(getExamAvailabilityStatus({ beginAt: NOW - 1000, endAt: NOW + 1000 }, NOW), "active");
  assert.equal(getExamAvailabilityStatus({ beginAt: NOW - 1000 }, NOW), "active", "begin only");
  assert.equal(getExamAvailabilityStatus({ endAt: NOW + 1000 }, NOW), "active", "end only");
  assert.equal(isExamStartable("active"), true);
  assert.equal(isExamStartable("open"), true);
  assert.equal(isExamStartable("upcoming"), false);
  assert.equal(isExamStartable("ended"), false);
});

test("participant exam view is the composite of session status over availability", () => {
  const open = {};
  const upcoming = { beginAt: NOW + 60_000 };
  const ended = { endAt: NOW - 60_000 };

  assert.equal(participantExamView(open, undefined, NOW), "dibuka");
  assert.equal(participantExamView(open, { status: "belum" }, NOW), "dibuka");
  assert.equal(participantExamView(open, { status: "sedang" }, NOW), "sedang");
  assert.equal(participantExamView(open, { status: "selesai" }, NOW), "selesai");
  assert.equal(participantExamView(upcoming, undefined, NOW), "belum-dibuka");
  assert.equal(participantExamView(ended, undefined, NOW), "ditutup");
  // session status wins over the time window, matching the dashboard badge order
  assert.equal(participantExamView(ended, { status: "selesai" }, NOW), "selesai");
  assert.equal(participantExamView(ended, { status: "sedang" }, NOW), "sedang");
  assert.equal(participantExamView(upcoming, { status: "selesai" }, NOW), "selesai");

  assert.equal(participantExamViewTone("selesai"), "active");
  assert.equal(participantExamViewTone("sedang"), "warn");
  assert.equal(participantExamViewTone("dibuka"), "active");
  assert.equal(participantExamViewTone("belum-dibuka"), "neutral");
  assert.equal(participantExamViewTone("ditutup"), "danger");
  for (const view of ["selesai", "sedang", "dibuka", "belum-dibuka", "ditutup"]) {
    assert.equal(typeof PARTICIPANT_EXAM_VIEW_LABELS[view], "string");
  }
});

test("token lifecycle: tersedia -> terpakai, expired tokens are kedaluwarsa and unclaimable", () => {
  assert.equal(tokenState({ dipakaiOleh: undefined, expireAt: undefined }, NOW), "tersedia");
  assert.equal(tokenState({ dipakaiOleh: "u_1", expireAt: undefined }, NOW), "terpakai");
  assert.equal(tokenState({ dipakaiOleh: undefined, expireAt: NOW - 1 }, NOW), "kedaluwarsa");
  assert.equal(tokenState({ dipakaiOleh: "u_1", expireAt: NOW + 1000 }, NOW), "terpakai");
  assert.equal(tokenState({ dipakaiOleh: "u_1", expireAt: NOW - 1 }, NOW), "kedaluwarsa", "expiry wins over claim");

  assert.equal(isTokenClaimableBy({ dipakaiOleh: undefined }, "u_1", NOW), true);
  assert.equal(isTokenClaimableBy({ dipakaiOleh: "u_1" }, "u_1", NOW), true, "re-claim by same user is idempotent");
  assert.equal(isTokenClaimableBy({ dipakaiOleh: "u_2" }, "u_1", NOW), false, "claimed by someone else");
  assert.equal(isTokenClaimableBy({ dipakaiOleh: undefined, expireAt: NOW - 1 }, "u_1", NOW), false, "expired");
});

test("result reveal requires a finished session plus explicit exam opt-in", () => {
  assert.equal(canRevealResult({ status: "selesai" }, { showResult: true, showResultDetail: true }), true);
  assert.equal(canRevealResult({ status: "sedang" }, { showResult: true, showResultDetail: true }), false);
  assert.equal(canRevealResult({ status: "selesai" }, { showResult: true, showResultDetail: false }), false);
  assert.equal(canRevealResult({ status: "selesai" }, { showResult: false, showResultDetail: true }), false);
  assert.equal(canRevealResult({ status: "selesai" }, undefined), false);
});

test("exam screen phase preserves the kerjakan render order", () => {
  const base = { examLocked: false, user: {}, ujian: {}, sesiDicari: true, sesi: {}, soalReady: true };
  assert.equal(examScreenPhase({ ...base, examLocked: true }), "locked", "lock wins over everything");
  assert.equal(examScreenPhase({ ...base, user: null }), "no-user");
  assert.equal(examScreenPhase({ ...base, ujian: undefined }), "no-exam");
  assert.equal(examScreenPhase({ ...base, sesiDicari: false }), "loading");
  assert.equal(examScreenPhase({ ...base, sesi: null }), "no-session");
  assert.equal(examScreenPhase({ ...base, soalReady: false }), "no-question");
  assert.equal(examScreenPhase(base), "running");
});

test("autosave reducer tracks edit -> flush -> saved/failed without losing newer edits", () => {
  const run = (...actions) => actions.reduce(nextSaveTracker, SAVE_INITIAL).state;
  const edit = { type: "edit" };
  const flush = (id) => ({ type: "flush", id });
  const ok = (id) => ({ type: "success", id });
  const fail = (id) => ({ type: "failure", id });

  assert.equal(run(edit), "dirty");
  assert.equal(run(edit, flush(1)), "saving");
  assert.equal(run(edit, flush(1), ok(1)), "saved");
  assert.equal(run(edit, flush(1), fail(1)), "failed");
  assert.equal(run(edit, flush(1), fail(1), edit), "dirty");
  assert.equal(run(edit, flush(1), { type: "reset" }), "clean");
  assert.equal(run(flush(1), ok(1)), "clean", "a flush with nothing dirty changes nothing");

  // a newer edit landing while a save is in flight keeps the state dirty on late success
  assert.equal(run(edit, flush(1), edit, ok(1)), "dirty");

  for (const state of ["clean", "dirty", "saving", "saved", "failed"]) {
    assert.equal(typeof SAVE_STATE_LABELS[state], "string");
  }
});

test("autosave ignores completions of an older save once a newer one started", () => {
  const run = (...actions) => actions.reduce(nextSaveTracker, SAVE_INITIAL).state;
  // A pending, B edited and flushed, A succeeds, then B fails: the failure must show.
  const seq = [{ type: "edit" }, { type: "flush", id: 1 }, { type: "edit" }, { type: "flush", id: 2 }];
  assert.equal(run(...seq, { type: "success", id: 1 }), "saving", "A's success must not mark B as saved");
  assert.equal(run(...seq, { type: "success", id: 1 }, { type: "failure", id: 2 }), "failed");
  assert.equal(run(...seq, { type: "failure", id: 1 }, { type: "success", id: 2 }), "saved");
});

test("autosave recovers when a failed save is retried without another edit", () => {
  const run = (...actions) => actions.reduce(nextSaveTracker, SAVE_INITIAL).state;
  const failed = [{ type: "edit" }, { type: "flush", id: 1 }, { type: "failure", id: 1 }];
  assert.equal(run(...failed, { type: "flush", id: 2 }), "saving");
  assert.equal(run(...failed, { type: "flush", id: 2 }, { type: "success", id: 2 }), "saved");
});

test("auth phase starts unknown and resolves from the user object", () => {
  assert.equal(AUTH_INITIAL_PHASE, "unknown");
  assert.equal(authPhaseOfUser({ id: "u_1" }), "authenticated");
  assert.equal(authPhaseOfUser(null), "anonymous");
});

test("generic request machine covers login/import/upload flows", () => {
  let s = "idle";
  s = nextRequestState(s, "start");
  assert.equal(s, "running");
  s = nextRequestState(s, "success");
  assert.equal(s, "success");
  s = nextRequestState(s, "reset");
  assert.equal(s, "idle");
  s = nextRequestState(s, "start");
  s = nextRequestState(s, "failure");
  assert.equal(s, "error");
  s = nextRequestState(s, "start");
  assert.equal(s, "running", "retry from error");
});
