# AGENTS.md — CBT-MAN

Dokumen ini adalah sumber utama aturan implementasi, arsitektur, keamanan, migrasi database, validasi, git workflow, dan pull request untuk CBT-MAN. Seluruh agen AI dan kontributor wajib membaca dan mematuhi dokumen ini serta [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## Ringkasan Aturan Utama (Non-Negotiable)

1. Mulai dari `origin/main` terbaru dan kerjakan **satu masalah atau fitur per branch/PR**.
2. Jangan membuka PR aggregate, membawa kembali commit/branch yang sudah ditolak, atau mencampur UI, refactor, dependency, dan fitur yang tidak berkaitan.
3. Jangan mengandalkan pembatasan UI untuk otorisasi. Semua read/mutation sensitif harus memverifikasi caller, role, ownership, dan scope di server.
4. Jangan mengubah Prisma schema tanpa migration additive yang dapat dideploy dan rencana preservasi data.
5. Jangan mengedit `src/routeTree.gen.ts` secara manual.
6. Jangan menambahkan artifact, file scratch, data upload, error dump, atau branding lama.
7. Jalankan seluruh gate lokal, termasuk `npm run check:prisma` saat gate database relevan, lalu tunggu `CI` serta review yang relevan sebelum menyatakan PR siap merge.
8. Jangan force-push, menghapus branch kontributor, menonaktifkan branch protection, atau meminta maintainer mengabaikan CI/review.

---

## Tujuan dan Batas Perubahan

CBT-MAN adalah aplikasi ujian berbasis komputer untuk pendidikan, dibangun dengan TanStack Start, React, TypeScript, Prisma, dan SQLite.

- Satu branch/PR hanya untuk satu masalah atau fitur yang dapat dijelaskan dan diverifikasi.
- Mulai dari `origin/main` terbaru. Jangan membangun di atas PR closed, branch stale, atau aggregate branch.
- Jangan mencampur redesign UI, refactor domain, perubahan dependency, migrasi database, dan perbaikan bug yang tidak terkait.
- Untuk perubahan arsitektur, model Prisma, akses peserta/operator, scoring, snapshot, token, atau session, diskusikan desain dan batas data terlebih dahulu.
- Jangan menambah dependency bila TypeScript, React, CSS, Prisma, atau dependency yang sudah ada dapat menyelesaikan kebutuhan.

---

## Peta Proyek

```text
src/routes/          Rute TanStack Start berbasis file dan layar aplikasi
src/components/      Komponen UI bersama
src/lib/cbt/         Tipe domain, repository client, akses, alur ujian
src/lib/server/      Server functions, auth, Prisma, snapshot, file access
prisma/              Schema, migrations, dan seed SQLite
tests/unit/          Test Node bawaan untuk policy, sanitizer, token, snapshot
.github/workflows/   CI GitHub Actions
```

Arsitektur utama adalah `routes → src/lib/cbt → src/lib/server → Prisma/SQLite`.

- `src/lib/cbt/repos.ts` melakukan sinkronisasi client dengan server functions; jangan gunakan generic upsert untuk mutation sempit/konkuren dari partial projection.
- `src/lib/server/db/auth.ts` menyediakan `requireCaller`, role check, dan scope helper. Gunakan boundary ini untuk read/mutation privat.
- `src/lib/server/repos/snapshot.ts` membangun snapshot berbeda untuk admin, operator, dan peserta. Perlakukan snapshot peserta sebagai batas kerahasiaan soal.
- `src/lib/cbt/access.ts` berisi predicate akses UI/domain. UI guard bukan pengganti server authorization.
- `src/routeTree.gen.ts` dibuat otomatis TanStack Router. **Jangan edit manual.** Ubah file di `src/routes/`; generator akan memperbarui tree.

---

## Aturan Keamanan dan Integritas Data

### Auth, Role, Ownership, dan Scope

- Semua server function yang membaca atau mengubah data privat harus memanggil `requireCaller()` atau helper yang setara.
- Terapkan role, ownership, dan scope pada server untuk setiap read, update, delete, token, file, session, dan audit. ID dari client bukan bukti akses.
- Jangan mengekspos `passwordHash`, jawaban benar, `pembahasan`, skor internal, atau metadata soal peserta sebelum aturan hasil mengizinkannya.
- Gunakan predicate akses yang sama pada snapshot, direct fetch, start/resume session, dan mutation. Jangan menduplikasi rule dengan semantik berbeda.
- Operator dibatasi oleh scope yang sama pada list, direct fetch, editor, dan mutation.

### Mutation dan Konkurensi

- Jangan mengirim object monitor/list/partial ke generic `upsert`; field yang tidak terlihat dapat terhapus.
- Untuk perubahan sempit (misalnya status sesi, skor, token, akses topik), buat server action/patch yang membaca state saat ini dan hanya mengubah field yang dimaksud.
- Jangan membiarkan autosave, submit, clear buffer, atau force-submit saling menimpa. Pastikan urutan dan kegagalan ditangani.
- Jangan menyimpan isi jawaban/essay di audit log kecuali requirement yang disetujui secara eksplisit dan telah ditinjau dari sisi privasi.
- Error tak terduga tidak boleh dikirim mentah ke pengguna akhir.

### Prisma dan Database

- Setiap perubahan persisted schema di `prisma/schema.prisma` wajib disertai migration baru di `prisma/migrations/`.
- Migration harus additive/data-preserving bila database yang sudah ada dapat berisi data. Jangan mengganti migration yang sudah pernah diterapkan.
- Jangan memakai `prisma db push` sebagai pengganti migration yang akan dideploy.
- Untuk rename/drop/relation rewrite: sertakan preflight data, backfill, perilaku orphan/null, rollback/backup note, dan test deploy fresh atau fixture migrasi.
- Setelah perubahan Prisma, jalankan `npx prisma validate` dan `npx prisma migrate deploy` pada database sementara/fresh bila migration terlibat.

---

## UI, Route, dan Aksesibilitas

- Pertahankan guard server ketika memperbaiki UI; UI filtering hanya UX.
- Gunakan komponen Radix/proyek yang telah ada. Jangan membuat fake button dari `div` atau kontrol tanpa keyboard/accessibility semantics.
- Untuk UI async, tangani rejection dan loading/error state.
- UI berbasis waktu harus memakai timezone yang disetujui (`Asia/Jakarta` bila menampilkan WIB) dan menghindari SSR hydration mismatch.
- Jangan mengembalikan route lama atau navigation yang tidak cocok dengan `ADMIN_ROUTE_RULES`/role access.

---

## File dan Perubahan yang Dilarang

Jangan masukkan dalam PR:

```text
scratch/**
ts_errors.txt
diff_users.txt
raw_*.tsx | raw_*.txt | temp_*.txt
data/uploads/**
dist/**
node_modules/**
coverage/**
artifacts/**
tests/output/**
playwright-report/**
*.db | *.sqlite | *.log
```

Jangan mengembalikan branding/metadata lama seperti `CBT-Kampus`, `cbt-kampus`, `CBT-UNIVERSITAS`, atau `cbt-universitas`.
Jangan mengubah nama package, lockfile metadata, atau dependency tanpa alasan yang terkait langsung dengan feature dan dijelaskan di PR.

---

## Cara Kerja dan Gate Lokal Wajib

1. Baca `README.md`, `CONTRIBUTING.md`, template PR, dan file yang akan disentuh.
2. Cari issue/PR terbuka **dan closed** yang membahas masalah sama. Jangan menduplikasi atau menghidupkan kembali aggregate branch yang pernah ditolak.
3. Tulis masalah nyata, dampak, scope, dan non-goal sebelum implementasi.
4. Terapkan diff minimal. Jangan melakukan cleanup/refactor kosmetik di luar scope.
5. Tambahkan test paling kecil yang menangkap logic baru/bug untuk perubahan non-trivial.
6. Jalankan seluruh gate lokal dan periksa diff/hygiene:

```bash
npm ci
npm run lint -- --max-warnings=7
npm run typecheck
npm run test:unit
npm run build
```

Tambahan bila relevan:
```bash
npx prisma validate
npx prisma migrate deploy
npm run check:prisma
```

Jangan menyatakan PR siap merge hanya karena build/typecheck lulus. CI hijau tidak membuktikan authorization, data migration, scope, privasi, atau race condition benar.

---

## Git Workflow & Anti-Stale Base Branching Protocol

You MUST strictly enforce the "Anti-Stale Base Branching Protocol" whenever you create a new Git branch or start working on a new feature/bugfix task.

### Mandatory Pre-Branching Execution Steps
Before creating any new branch or making code changes, execute the following sequence:

1. **Fetch Latest Remote State:**
   Always sync the local repository with remote tracking branches first.
   `git fetch origin`

2. **Verify Base Freshness:**
   Check if the base branch (e.g., `main` or `develop`) is up to date with `origin`.
   - Never branch directly off an unverified local branch.
   - Always derive new branches explicitly from updated remote tracking refs, e.g.:
     `git checkout -b <feature-branch-name> origin/main`
     OR checkout the base, pull, then create:
     `git checkout main && git pull origin main && git checkout -b <feature-branch-name>`

3. **Validation Rule (Hard Stop):**
   - If the local base branch is behind `origin/<base-branch>` by 1 or more commits, DO NOT create the feature branch until `git pull` or `git fetch` is completed.
   - NEVER create a feature branch off a temporary or outdated local topic branch unless explicitly requested by the user.

---

## Aturan Pull Request

- Jangan force-push; gunakan push normal untuk commit perbaikan baru.
- Jangan menonaktifkan branch protection, override `CI`, menghapus branch kontributor, atau meminta merge tanpa review.
- Jangan merge/rebase PR yang `CONFLICTING`, `DIRTY`, stale terhadap main, atau membawa artifact terlarang.
- Jika branch stale/aggregate memuat bagian yang masih berguna, buat replacement PR kecil dari main terbaru dan dokumentasikan kredit terhadap PR asal.
- Semua reviewer finding harus diklasifikasikan: fixed, obsolete dengan bukti, atau refuted dengan alasan teknis. Jangan resolve thread tanpa bukti.
- Sebelum merge, state dan CI harus dicek lagi pada head SHA yang sama.
- Sebelum membuka PR, baca seluruh [template PR](./.github/PULL_REQUEST_TEMPLATE.md) dan isi dengan bukti spesifik. Jika tidak dapat menjawab template dengan fakta, jangan buka PR.

---

## Changelog

Gunakan [`CHANGELOG.md`](./CHANGELOG.md). Tambahkan item ke `Unreleased` pada PR user-facing, security, data migration, atau developer workflow yang relevan. Jangan mencatat refactor internal murni kecuali mengubah perilaku yang perlu diketahui pengguna/maintainer.
