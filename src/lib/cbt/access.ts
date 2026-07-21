// Helpers untuk membatasi akses berdasarkan `allowedTopikIds` user
// - admin selalu boleh akses semua
// - operator: dibatasi ke topik yang ada dalam `allowedTopikIds`
//   (kosong = boleh akses semua, sesuai UI di /admin/users/roles)
// - peserta: tidak relevan (mereka mengikuti ujian, bukan kelola)

import type { User, Ujian } from "./types";
import { topikRepo, soalRepo, modulRepo, ujianRepo } from "./repos";

/**
 * Thrown by `buildSesi` / `findOrCreateSesi` when a participant tries to
 * start or resume a session for an exam that is not assigned to their
 * group. The pre-exam route also guards against this in the UI, but the
 * session builder re-checks (defense in depth) so that direct server
 * calls and stale client state cannot bypass the policy.
 */
export class PesertaNotAssignedToExamError extends Error {
  readonly code = "PESERTA_NOT_ASSIGNED_TO_EXAM";
  readonly ujianId: string;
  readonly pesertaId: string;

  constructor(message: string, context: { ujianId: string; pesertaId: string }) {
    super(message);
    this.name = "PesertaNotAssignedToExamError";
    this.ujianId = context.ujianId;
    this.pesertaId = context.pesertaId;
  }
}

export function isUnrestricted(user: User | null | undefined): boolean {
  if (!user) return false;
  if (user.role === "super_admin") return true;
  if (
    (user.role === "admin_prodi" || user.role === "evaluator") &&
    (user.allowedTopikIds?.length ?? 0) === 0
  )
    return true;
  return false;
}

export function allowedTopikIdSet(user: User | null | undefined): Set<string> | null {
  if (isUnrestricted(user)) return null; // null = tanpa batasan
  return new Set(user?.allowedTopikIds ?? []);
}

export function isTopikAllowed(user: User | null | undefined, topikId: string): boolean {
  if (isUnrestricted(user)) return true;
  const set = new Set(user?.allowedTopikIds ?? []);
  if (set.has(topikId)) return true;
  
  // Periksa apakah topik ini berada di dalam modul mata kuliah user
  const mkSet = new Set(user?.mataKuliahIds ?? []);
  const topik = topikRepo.byId(topikId);
  if (!topik) return false;
  const modul = modulRepo.byId(topik.modulId);
  if (modul?.mataKuliahId && mkSet.has(modul.mataKuliahId)) return true;
  
  return false;
}

export function visibleTopiks(user: User | null | undefined) {
  const all = topikRepo.all();
  return all.filter((t) => isTopikAllowed(user, t.id));
}

export function visibleSoals(user: User | null | undefined) {
  const all = soalRepo.all();
  return all.filter((s) => isTopikAllowed(user, s.topikId));
}

export function visibleModuls(user: User | null | undefined) {
  if (isUnrestricted(user)) return modulRepo.all();
  const topikSet = new Set(user?.allowedTopikIds ?? []);
  const mkSet = new Set(user?.mataKuliahIds ?? []);
  const all = modulRepo.all();
  
  const allowedModulIds = new Set(
    topikRepo
      .all()
      .filter((t) => topikSet.has(t.id))
      .map((t) => t.modulId),
  );
  return all.filter((m) => 
    (m.mataKuliahId && mkSet.has(m.mataKuliahId)) || allowedModulIds.has(m.id)
  );
}

// Ujian dianggap "touchable" (editable / manageable) oleh operator jika
// **seluruh** topicSet-nya menyentuh topik yang diizinkan. Konsisten
// dengan server-side `operatorCanTouchTopicSets` di
// `src/lib/server/repos/functions.ts:340` (juga `every`).
//
// Catatan penting: untuk daftar ujian yang ditampilkan ke operator
// (`visibleUjians` di bawah) kita tetap menggunakan `some` — itu
// "tampilkan ujian yang menyentuh minimal satu topik diizinkan", yang
// adalah filter visibilitas, bukan gate edit. Di sini, pada guard
// editor/token, kita harus `every` agar:
//   1. Server-side `mutateEntity` tidak menolak save dari klien yang
//      tampak mengizinkan edit. Pagar server sudah `every`; pagar
//      klien harus sama agar UX tidak menjebak operator.
//   2. Mencegah serangan "narrowing": tanpa `every`, operator bisa
//      membuka editor ujian mixed-scope, menghapus topic set di luar
//      scope, lalu save (server izinkan karena topik akhir tetap
//      `every` in-scope). Dengan `every`, editor terkunci untuk
//      ujian mixed-scope dan struktur ujian tidak dapat dimodifikasi.
//
// Perilaku sebelumnya (`some`) adalah regresi defence-in-depth yang
// ditemukan di review adversarial Issue #10.
export function ujianTouchesAllowed(user: User | null | undefined, ujian: Ujian): boolean {
  if (isUnrestricted(user)) return true;
  const mkSet = new Set(user?.mataKuliahIds ?? []);
  if (ujian.mataKuliahId && mkSet.has(ujian.mataKuliahId)) return true;
  const set = new Set(user?.allowedTopikIds ?? []);
  if (set.size === 0 && mkSet.size === 0) return true; // unrestricted (though handled above)
  return ujian.topicSets.length > 0 && ujian.topicSets.every((ts) => set.has(ts.topikId));
}

export function visibleUjians(user: User | null | undefined) {
  if (isUnrestricted(user)) return ujianRepo.all();
  const set = new Set(user?.allowedTopikIds ?? []);
  const mkSet = new Set(user?.mataKuliahIds ?? []);
  const all = ujianRepo.all();
  return all.filter((u) => 
    (u.mataKuliahId && mkSet.has(u.mataKuliahId)) || 
    u.topicSets.some((ts) => set.has(ts.topikId))
  );
}

// ---------------- Peserta exam-group assignment ----------------
//
// Exam assignment is enforced at three layers, all backed by the same
// predicate below:
//   1. Dashboard list filters out exams outside the participant's group
//      (`src/routes/_authenticated/peserta.index.tsx`).
//   2. Pre-exam direct URL is blocked before token redemption / session
//      creation (`src/routes/_authenticated/peserta.ujian.$id.tsx`).
//   3. The session builder itself re-checks before producing a sesi, so
//      server-side `mutateEntity` calls and stale client state cannot
//      bypass the policy (`src/lib/cbt/exam.ts`).
//
// An empty `ujian.groupIds` is treated as "open to all participants"
// (existing convention: dashboards/tests rely on it). Otherwise the
// participant's `user.groupId` must be a member of `ujian.groupIds`.
export function isParticipantAssignedToExam(
  user: User | null | undefined,
  ujian: Pick<Ujian, "groupIds">,
): boolean {
  if (!user) return false;
  const groupIds = ujian.groupIds ?? [];
  if (groupIds.length === 0) return true;
  if (!user.groupId) return false;
  return groupIds.includes(user.groupId);
}

/**
 * Combined predicate for the peserta pre-exam entrypoint. Today it is
 * just the assignment check, but having a single named entrypoint means
 * future availability/feature flags (e.g. token-aktif gating) can be
 * added without changing the route signature.
 */
export function participantCanAccessUjian(user: User | null | undefined, ujian: Ujian): boolean {
  return isParticipantAssignedToExam(user, ujian);
}
