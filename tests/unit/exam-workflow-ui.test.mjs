import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function read(rel) {
  return readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");
}

test("exam list exposes class assignment and lifecycle status", () => {
  const route = read("src/routes/_authenticated/admin.ujian.tsx");
  assert.match(route, /penawaranRepo/);
  assert.match(route, /kelas\.pesertaIds\.length/);
  assert.match(route, /u\.status === "published"/);
});

test("file drive exposes jurusan buckets and date sorting", () => {
  const route = read("src/routes/_authenticated/admin.files.tsx");
  const filesServer = read("src/lib/server/files/functions.ts");
  assert.match(route, /Bucket penyimpanan/);
  assert.match(route, /Buat Bucket/);
  assert.match(route, /tipe: "kategori_bebas"/);
  assert.match(route, /u\.tipe === "jurusan" \|\| u\.tipe === "prodi"/);
  assert.match(route, /Paling baru/);
  assert.match(route, /Paling lama/);
  assert.match(route, /sortOrder === "newest"/);
  assert.match(route, /bucketCounts\[jurusan\.id\]/);
  assert.match(route, /putFile\(f, targetJurusan, targetBucketId\)/);
  assert.match(filesServer, /bucket\.tipe !== "kategori_bebas"/);
  assert.match(filesServer, /bucketId: data\.bucketId/);
});

test("unused broad exam-list server endpoint stays removed", () => {
  const server = read("src/lib/server/ujian/functions.ts");
  assert.doesNotMatch(server, /export const getUjiansList/);
});

test("class workflow refreshes authoritative core data and uses guarded membership updates", () => {
  const route = read("src/routes/_authenticated/admin.akademik.kelas-mata-kuliah.tsx");
  assert.match(route, /await hydrateRepos\(\)/);
  assert.match(route, /penawaranRepo\.updateMembership/);
  assert.doesNotMatch(route, /penawaranRepo\.(?:upsert|remove)/);
});

test("published and ongoing exams keep the edit action with question source guards", () => {
  const list = read("src/routes/_authenticated/admin.ujian.tsx");
  const editor = read("src/routes/_authenticated/admin.ujian.$id.tsx");
  const server = read("src/lib/server/ujian/functions.ts");

  assert.match(list, /to="\/admin\/ujian\/\$id"/);
  assert.match(list, /Users className=.*Peserta/);
  assert.doesNotMatch(list, /\{sesiCount === 0 && \(\s*<Link to="\/admin\/ujian\/\$id"/);
  assert.match(editor, /hasSessions/);
  assert.match(editor, /const locked = u\.status !== "draft" \|\| hasSessions/);
  assert.match(editor, /<fieldset disabled=\{locked\}/);
  assert.match(editor, /const result = await ujianRepo\.flush\(\)/);
  assert.match(server, /if \(existing\?\.status === "published"\) throw new Error/);
  assert.match(server, /where: \{ id: item\.id, status: "draft" \}, data: writeData/);
});

test("participant UI does not offer resume after the exam window closes", () => {
  const dashboard = read("src/routes/_authenticated/peserta.index.tsx");
  const preExam = read("src/routes/_authenticated/peserta.ujian.$id.index.tsx");

  assert.match(dashboard, /const isStartable = availability === "active" \|\| availability === "open"/);
  assert.match(preExam, /const canOpen = examAllowed/);
  assert.match(preExam, /s\.endsAt !== undefined && s\.endsAt > Date\.now\(\)/);
  assert.match(preExam, /ujian\.endAt === undefined \|\| ujian\.endAt > Date\.now\(\)/);
});

test("creating an exam opens its setup editor immediately", () => {
  const route = read("src/routes/_authenticated/admin.ujian.tsx");

  assert.match(route, /const result = await ujianRepo\.flush\(\)/);
  assert.match(route, /if \(!result\.ok\)/);
  assert.match(route, /navigate\(\{ to: "\/admin\/ujian\/\$id", params: \{ id: u\.id \} \}\)/);
});

test("exam participant page uses responsive content width and shared admin theme", () => {
  const participants = read("src/routes/_authenticated/admin.ujian.$id.peserta.tsx");

  assert.match(participants, /max-w-6xl pb-12/);
  assert.match(participants, /overflow-x-auto/);
  assert.match(participants, /AdminPageHeader/);
  assert.match(participants, /AdminPageContent/);
});

test("exam participant page keeps visible back navigation to editor", () => {
  const participants = read("src/routes/_authenticated/admin.ujian.$id.peserta.tsx");

  assert.match(participants, /to="\/admin\/ujian\/\$id"[\s\S]*Kembali ke Editor/);
});

test("exam editor uses the shared header and 2-column layout", () => {
  const route = read("src/routes/_authenticated/admin.ujian.$id.tsx");

  assert.match(route, /<AdminPage className="mx-auto w-full max-w-\[1600px\] pb-12">/);
  assert.match(route, /<AdminPageHeader[\s\S]*Editor Paket Ujian/);
  assert.match(route, /<ArrowLeft className="mr-1 h-4 w-4" \/>[\s\S]*Kembali/);
  assert.doesNotMatch(route, /Mode Pengaturan Ujian Berlangsung \/ Memiliki Sesi/);
});

test("exam editor deletion uses a themed confirmation dialog", () => {
  const route = read("src/routes/_authenticated/admin.ujian.$id.tsx");

  assert.doesNotMatch(route, /\bconfirm\(/);
  assert.match(route, /onClick=\{\(\) => setDeleteOpen\(true\)\}/);
  assert.match(route, /<ConfirmDialog[\s\S]*title="Hapus Ujian"/);
});

test("draft exams stay in preparation even when their schedule is active", () => {
  const route = read("src/routes/_authenticated/admin.ujian.tsx");

  assert.match(route, /u\.status === "draft" \|\| !u\.beginAt \|\| !u\.endAt/);
  assert.match(route, /u\.status === "published" && u\.beginAt && u\.endAt/);
  assert.match(route, /const status = u\.status === "draft" \|\| !u\.beginAt \|\| !u\.endAt \|\| u\.beginAt > now/);
  assert.match(route, /\? "persiapan"/);
});

test("exam schedule can be extended via narrow server action and list rows stay simplified", () => {
  const list = read("src/routes/_authenticated/admin.ujian.tsx");
  const editor = read("src/routes/_authenticated/admin.ujian.$id.tsx");
  const server = read("src/lib/server/ujian/functions.ts");

  assert.match(server, /export const extendJadwalUjianServer = createServerFn/);
  assert.match(server, /action: "ujian\.extendJadwal"/);
  assert.match(server, /newEndAt <= Number\(exam\.beginAt\)/);
  assert.match(server, /tx\.ujian\.updateMany\(\{[\s\S]*where: \{ id: data\.ujianId, status: "published", endAt: exam\.endAt \},[\s\S]*data: \{ endAt: BigInt\(data\.newEndAt\) \}/);

  // List rows have clean action buttons
  assert.match(list, /Users className="h-3\.5 w-3\.5"/);

  // Sub-features live inside the editor
  assert.match(editor, /KeyRound/);
  assert.match(editor, /Users className=.*Peserta/);
  assert.match(editor, /extendJadwalUjianServer/);
  assert.match(editor, /Perpanjang Jadwal/);
});

test("exam sessions can be reset individually or in bulk with themed confirmations", () => {
  const participants = read("src/routes/_authenticated/admin.ujian.$id.peserta.tsx");
  const analytics = read("src/routes/_authenticated/admin.analitik.$id.tsx");
  const server = read("src/lib/server/sesi/functions.ts");

  assert.match(server, /export const deleteAllExamSessionsServer = createServerFn/);
  assert.match(server, /tx\.sesiUjian\.deleteMany\(\{ where: \{ ujianId: data\.ujianId \} \}\)/);
  assert.match(server, /tx\.tokenClaim\.deleteMany\(\{ where: \{ ujianId: data\.ujianId \} \}\)/);
  assert.match(server, /caller\.role !== "admin_prodi"/);
  assert.match(server, /operatorHasAnyNav\(caller, OPERATOR_SESSION_KEYS\)/);
  assert.match(server, /tx\.tokenUjian\.updateMany\(/);
  assert.match(participants, /Hapus Semua Sesi/);
  assert.match(participants, /Hapus Sesi/);
  assert.match(participants, /<ConfirmDialog[\s\S]*title="Hapus Sesi Peserta\?"/);
  assert.match(participants, /<ConfirmDialog[\s\S]*title="Hapus Semua Sesi Ujian\?"/);
  assert.match(analytics, /Hapus Semua Sesi/);
  assert.match(analytics, /<ConfirmDialog[\s\S]*title="Hapus Semua Sesi Ujian\?"/);
});

test("essay question textarea provides clean distraction-free card with auto-save and word counter", () => {
  const kerjakan = read("src/routes/_authenticated/peserta.ujian.$id.kerjakan.tsx");

  assert.doesNotMatch(kerjakan, /bg-gradient-to-r from-primary\/50 to-primary/);
  assert.doesNotMatch(kerjakan, /blur transition duration-300/);
  assert.match(kerjakan, /Jawaban tersimpan otomatis/);
  assert.match(kerjakan, /kata · .*karakter/);
  assert.match(kerjakan, /aria-label=\{`Jawaban esai soal nomor \$\{idx \+ 1\}`\}/);
});
