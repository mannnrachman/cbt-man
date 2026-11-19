/**
 * state-machines.ts — the explicit state machines of CBT-MAN.
 *
 * Every implicit state machine in the app is declared here as data plus pure
 * functions: states, legal transitions, guards, and reducers. UI components
 * and server functions should call these instead of re-deriving state from
 * raw string comparisons, so there is exactly one source of truth for what
 * states exist and which transitions are legal.
 *
 * Machines:
 *   1. sessionLifecycle      — SesiUjian.status (belum → sedang → selesai)
 *   2. examLifecycle         — Ujian.status (draft → published)
 *   3. examAvailability      — time-window status of an exam (re-exported)
 *   4. participantExamView   — composite of availability × session status
 *   5. tokenLifecycle        — TokenUjian (tersedia / terpakai / kedaluwarsa)
 *   6. resultReveal          — when answer keys/pembahasan may be shown
 *   7. examScreenPhase       — phase machine of the kerjakan screen
 *   8. autosave              — reducer driving the autosave indicator
 *   9. auth                  — auth store phase (unknown/authenticated/anonymous)
 *  10. request               — generic idle/running/success/error machine used
 *                              by login, import, and upload flows
 *
 * This module is pure and is imported directly by tests/unit, so it must only
 * use relative imports with explicit `.ts` extensions (see excel.ts) and
 * must never touch browser or node APIs.
 */

import type { SesiUjian, StatusSesi, StatusUjian, TokenUjian, Ujian } from "./types.ts";
import { getExamAvailabilityStatus, type ExamAvailability } from "./availability.ts";

// ---------------- 1. Session lifecycle ----------------
// belum → sedang (createSesi) → selesai (submit / forceSubmit / timeout /
// violation lock). "selesai" is terminal: it only maps to itself (idempotent
// re-grade by an operator). "kedaluwarsa" is declared in the Prisma enum but
// never assigned today; it is reserved and treated as terminal.

export const SESSION_STATES = ["belum", "sedang", "selesai", "kedaluwarsa"] as const satisfies readonly StatusSesi[];
export type SessionState = StatusSesi;

const SESSION_TRANSITIONS: Readonly<Record<SessionState, readonly SessionState[]>> = {
	belum: ["sedang"],
	sedang: ["selesai"],
	selesai: ["selesai"],
	kedaluwarsa: ["kedaluwarsa"],
};

export function canTransitionSession(from: SessionState, to: SessionState): boolean {
	return SESSION_TRANSITIONS[from].includes(to);
}

export function isSessionActive(status: StatusSesi): boolean {
	return status === "sedang";
}

export function isSessionFinished(status: StatusSesi): boolean {
	return status === "selesai";
}

export function isSessionTerminal(status: StatusSesi): boolean {
	return status === "selesai" || status === "kedaluwarsa";
}

/** A running session may be resumed only while both deadlines are in the future. */
export function isSessionResumable(
	sesi: Pick<SesiUjian, "status" | "endsAt">,
	ujian: Pick<Ujian, "endAt">,
	now: number = Date.now(),
): boolean {
	return (
		isSessionActive(sesi.status) &&
		sesi.endsAt !== undefined &&
		sesi.endsAt > now &&
		(ujian.endAt === undefined || ujian.endAt > now)
	);
}

// ---------------- 2. Exam lifecycle ----------------
// draft → published via the "publish" action (readiness-gated on the server).
// published is terminal for structural edits: the editor locks and the
// server only updates rows still in "draft".

export const EXAM_STATES = ["draft", "published"] as const satisfies readonly StatusUjian[];
export type ExamState = StatusUjian;

const EXAM_TRANSITIONS: Readonly<Record<ExamState, readonly ExamState[]>> = {
	draft: ["draft", "published"],
	published: ["published"],
};

export function canTransitionExam(from: ExamState, to: ExamState): boolean {
	return EXAM_TRANSITIONS[from].includes(to);
}

export function isExamPublished(status: StatusUjian): boolean {
	return status === "published";
}

/** Editor lock rule: a draft with no sessions yet is editable. */
export function isExamEditableInEditor(status: StatusUjian, hasSessions: boolean): boolean {
	return status === "draft" && !hasSessions;
}

// ---------------- 3. Exam availability (time window) ----------------
// Re-exported here so agents have one entry point for every machine.

export { getExamAvailabilityStatus, isExamAvailable } from "./availability.ts";
export type { ExamAvailability } from "./availability.ts";

export function isExamStartable(availability: ExamAvailability): boolean {
	return availability === "active" || availability === "open";
}

// ---------------- 4. Participant exam view (availability × session) ----------------
// The composite machine behind the peserta dashboard badge.

export const PARTICIPANT_EXAM_VIEWS = ["selesai", "sedang", "dibuka", "belum-dibuka", "ditutup"] as const;
export type ParticipantExamView = (typeof PARTICIPANT_EXAM_VIEWS)[number];
export type ParticipantExamBadgeTone = "neutral" | "active" | "warn" | "danger";

export function participantExamView(
	ujian: Pick<Ujian, "beginAt" | "endAt">,
	sesi: Pick<SesiUjian, "status"> | undefined,
	now: number = Date.now(),
): ParticipantExamView {
	const status = sesi?.status ?? "belum";
	if (isSessionFinished(status)) return "selesai";
	if (isSessionActive(status)) return "sedang";
	const availability = getExamAvailabilityStatus(ujian, now);
	if (isExamStartable(availability)) return "dibuka";
	if (availability === "upcoming") return "belum-dibuka";
	return "ditutup";
}

export function participantExamViewTone(view: ParticipantExamView): ParticipantExamBadgeTone {
	switch (view) {
		case "selesai":
			return "active";
		case "sedang":
			return "warn";
		case "dibuka":
			return "active";
		case "belum-dibuka":
			return "neutral";
		case "ditutup":
			return "danger";
	}
}

export const PARTICIPANT_EXAM_VIEW_LABELS: Record<ParticipantExamView, string> = {
	selesai: "Selesai",
	sedang: "Sedang dikerjakan",
	dibuka: "Dibuka",
	"belum-dibuka": "Belum dibuka",
	ditutup: "Ditutup",
};

// ---------------- 5. Token lifecycle ----------------
// tersedia → terpakai (claimed). A token past expireAt is kedaluwarsa and can
// no longer be claimed. Claims are idempotent for the same participant;
// deleting all sessions resets tokens to tersedia.

export const TOKEN_STATES = ["tersedia", "terpakai", "kedaluwarsa"] as const;
export type TokenState = (typeof TOKEN_STATES)[number];

export function tokenState(
	token: Pick<TokenUjian, "dipakaiOleh" | "expireAt">,
	now: number = Date.now(),
): TokenState {
	if (token.expireAt !== undefined && now > Number(token.expireAt)) return "kedaluwarsa";
	return token.dipakaiOleh ? "terpakai" : "tersedia";
}

export function isTokenClaimableBy(
	token: Pick<TokenUjian, "dipakaiOleh" | "expireAt">,
	userId: string,
	now: number = Date.now(),
): boolean {
	return tokenState(token, now) !== "kedaluwarsa" && (!token.dipakaiOleh || token.dipakaiOleh === userId);
}

// ---------------- 6. Result reveal ----------------
// Answer keys and pembahasan stay redacted until the session is selesai AND
// the exam allows result detail.

export function canRevealResult(
	session: Pick<SesiUjian, "status">,
	exam: Pick<Ujian, "showResult" | "showResultDetail"> | undefined,
): boolean {
	return isSessionFinished(session.status) && !!exam?.showResult && !!exam.showResultDetail;
}

// ---------------- 7. Exam screen phase (kerjakan route) ----------------
// Single definition of the render order: locked → no-user → no-exam →
// loading → no-session → no-question → running.

export const EXAM_SCREEN_PHASES = [
	"locked",
	"no-user",
	"no-exam",
	"loading",
	"no-session",
	"no-question",
	"running",
] as const;
export type ExamScreenPhase = (typeof EXAM_SCREEN_PHASES)[number];

export function examScreenPhase(input: {
	examLocked: boolean;
	user: unknown;
	ujian: unknown;
	sesiDicari: boolean;
	sesi: unknown;
	soalReady: boolean;
}): ExamScreenPhase {
	if (input.examLocked) return "locked";
	if (!input.user) return "no-user";
	if (!input.ujian) return "no-exam";
	if (!input.sesiDicari) return "loading";
	if (!input.sesi) return "no-session";
	if (!input.soalReady) return "no-question";
	return "running";
}

// ---------------- 8. Autosave reducer (kerjakan header indicator) ----------------
// clean → dirty (edit) → saving (flush #id) → saved | failed. Every flush carries
// an id and only the completion of the latest flush counts: a newer edit or a
// newer flush makes earlier completions stale, so they cannot mark newer
// answers as saved (or failed). A flush after a failure retries the save.

export const SAVE_STATES = ["clean", "dirty", "saving", "saved", "failed"] as const;
export type SaveState = (typeof SAVE_STATES)[number];
export type SaveTracker = { readonly state: SaveState; readonly pending: number | null };
export type SaveAction =
	| { type: "edit" }
	| { type: "flush"; id: number }
	| { type: "success"; id: number }
	| { type: "failure"; id: number }
	| { type: "reset" };

export const SAVE_INITIAL: SaveTracker = { state: "clean", pending: null };

export function nextSaveTracker(tracker: SaveTracker, action: SaveAction): SaveTracker {
	switch (action.type) {
		case "edit":
			return { state: "dirty", pending: null };
		case "reset":
			return SAVE_INITIAL;
		case "flush":
			// Every flush is tracked, including one from clean/saved (submit or question
			// navigation without an edit), so its failure is not hidden.
			return { state: "saving", pending: action.id };
		case "success":
		case "failure":
			if (tracker.pending !== action.id) return tracker;
			return { state: action.type === "success" ? "saved" : "failed", pending: null };
	}
}

export const SAVE_STATE_LABELS: Record<SaveState, string> = {
	clean: "Tersimpan",
	dirty: "Belum tersimpan",
	saving: "Menyimpan…",
	saved: "Tersimpan",
	failed: "Gagal menyimpan — periksa koneksi lalu jawab ulang",
};

// ---------------- 9. Auth phase ----------------
// The auth store starts "unknown" (no server validation yet), then resolves
// to "authenticated" or "anonymous" via validateSession/login, and returns
// to "anonymous" on logout.

export const AUTH_PHASES = ["unknown", "authenticated", "anonymous"] as const;
export type AuthPhase = (typeof AUTH_PHASES)[number];

export const AUTH_INITIAL_PHASE: AuthPhase = "unknown";

export function authPhaseOfUser(user: unknown): Exclude<AuthPhase, "unknown"> {
	return user ? "authenticated" : "anonymous";
}

// ---------------- 10. Generic request machine ----------------
// Shared vocabulary for login (LoginModal), Excel/Word import, and file
// upload screens, which today track the same flow as ad-hoc booleans.

export const REQUEST_STATES = ["idle", "running", "success", "error"] as const;
export type RequestState = (typeof REQUEST_STATES)[number];
export type RequestEvent = "start" | "success" | "failure" | "reset";

const REQUEST_TRANSITIONS: Readonly<Record<RequestState, Readonly<Record<RequestEvent, RequestState>>>> = {
	idle: { start: "running", success: "idle", failure: "idle", reset: "idle" },
	running: { start: "running", success: "success", failure: "error", reset: "idle" },
	success: { start: "running", success: "success", failure: "error", reset: "idle" },
	error: { start: "running", success: "success", failure: "error", reset: "idle" },
};

export function nextRequestState(state: RequestState, event: RequestEvent): RequestState {
	return REQUEST_TRANSITIONS[state][event];
}
