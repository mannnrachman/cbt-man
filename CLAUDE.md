# CLAUDE.md — Petunjuk Kontributor AI CBT-MAN

Baca seluruh dokumen ini sebelum mengubah repository. Aturan ini berlaku untuk agen AI dan menjadi pelengkap [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## Tujuan dan batas perubahan

CBT-MAN adalah aplikasi ujian berbasis komputer untuk pendidikan, dibangun dengan TanStack Start, React, TypeScript, Prisma, dan SQLite.

- Satu branch/PR hanya untuk satu masalah atau fitur yang dapat dijelaskan dan diverifikasi.
- Mulai dari `origin/main` terbaru. Jangan membangun di atas PR closed, branch stale, atau aggregate branch.
- Jangan mencampur redesign UI, refactor domain, perubahan dependency, migrasi database, dan perbaikan bug yang tidak terkait.
- Untuk perubahan arsitektur, model Prisma, akses peserta/operator, scoring, snapshot, token, atau session, diskusikan desain dan batas data terlebih dahulu.
- Jangan menambah dependency bila TypeScript, React, CSS, Prisma, atau dependency yang sudah ada dapat menyelesaikan kebutuhan.

## Peta proyek

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

## Aturan keamanan dan integritas data

### Auth, role, ownership, dan scope

- Semua server function yang membaca atau mengubah data privat harus memanggil `requireCaller()` atau helper yang setara.
- Terapkan role, ownership, dan scope pada server untuk setiap read, update, delete, token, file, session, dan audit. ID dari client bukan bukti akses.
- Jangan mengekspos `passwordHash`, jawaban benar, `pembahasan`, skor internal, atau metadata soal peserta sebelum aturan hasil mengizinkannya.
- Gunakan predicate akses yang sama pada snapshot, direct fetch, start/resume session, dan mutation. Jangan menduplikasi rule dengan semantik berbeda.
- Operator dibatasi oleh scope yang sama pada list, direct fetch, editor, dan mutation.

### Mutation dan konkurensi

- Jangan mengirim object monitor/list/partial ke generic `upsert`; field yang tidak terlihat dapat terhapus.
- Untuk perubahan sempit (misalnya status sesi, skor, token, akses topik), buat server action/patch yang membaca state saat ini dan hanya mengubah field yang dimaksud.
- Jangan membiarkan autosave, submit, clear buffer, atau force-submit saling menimpa. Pastikan urutan dan kegagalan ditangani.
- Jangan menyimpan isi jawaban/essay di audit log kecuali requirement yang disetujui secara eksplisit dan telah ditinjau dari sisi privasi.
- Error tak terduga tidak boleh dikirim mentah ke pengguna akhir.

### Prisma dan database

- Setiap perubahan persisted schema di `prisma/schema.prisma` wajib disertai migration baru di `prisma/migrations/`.
- Migration harus additive/data-preserving bila database yang sudah ada dapat berisi data. Jangan mengganti migration yang sudah pernah diterapkan.
- Jangan memakai `prisma db push` sebagai pengganti migration yang akan dideploy.
- Untuk rename/drop/relation rewrite: sertakan preflight data, backfill, perilaku orphan/null, rollback/backup note, dan test deploy fresh atau fixture migrasi.
- Setelah perubahan Prisma, jalankan `npx prisma validate` dan `npx prisma migrate deploy` pada database sementara/fresh bila migration terlibat.

## UI, route, dan aksesibilitas

- Pertahankan guard server ketika memperbaiki UI; UI filtering hanya UX.
- Gunakan komponen Radix/proyek yang telah ada. Jangan membuat fake button dari `div` atau kontrol tanpa keyboard/accessibility semantics.
- Untuk UI async, tangani rejection dan loading/error state.
- UI berbasis waktu harus memakai timezone yang disetujui (`Asia/Jakarta` bila menampilkan WIB) dan menghindari SSR hydration mismatch.
- Jangan mengembalikan route lama atau navigation yang tidak cocok dengan `ADMIN_ROUTE_RULES`/role access.

## File dan perubahan yang dilarang

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

## Cara kerja wajib

1. Baca `README.md`, `CONTRIBUTING.md`, template PR, dan file yang akan disentuh.
2. Cari issue/PR terbuka **dan closed** yang membahas masalah sama. Jangan menduplikasi atau menghidupkan kembali aggregate branch yang pernah ditolak.
3. Tulis masalah nyata, dampak, scope, dan non-goal sebelum implementasi.
4. Buat branch dari main terbaru:
   ```bash
   git fetch origin main
   git switch -c <type>/<deskripsi-singkat> origin/main
   ```
5. Terapkan diff minimal. Jangan melakukan cleanup/refactor kosmetik di luar scope.
6. Tambahkan test paling kecil yang menangkap logic baru/bug untuk perubahan non-trivial.
7. Jalankan seluruh gate lokal dan periksa diff/hygiene.
8. Buka PR hanya setelah template dapat diisi dengan jawaban faktual.
9. Setelah push, tunggu `CI` pada **head SHA terbaru** dan tangani semua review thread aktif.

## Gate lokal wajib

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

## Git dan pull request

- Jangan force-push; gunakan push normal untuk commit perbaikan baru.
- Jangan menonaktifkan branch protection, override `CI`, menghapus branch kontributor, atau meminta merge tanpa review.
- Jangan merge/rebase PR yang `CONFLICTING`, `DIRTY`, stale terhadap main, atau membawa artifact terlarang.
- Jika branch stale/aggregate memuat bagian yang masih berguna, buat replacement PR kecil dari main terbaru dan dokumentasikan kredit terhadap PR asal.
- Semua reviewer finding harus diklasifikasikan: fixed, obsolete dengan bukti, atau refuted dengan alasan teknis. Jangan resolve thread tanpa bukti.
- Sebelum merge, state dan CI harus dicek lagi pada head SHA yang sama.

## Changelog

Gunakan [`CHANGELOG.md`](./CHANGELOG.md). Tambahkan item ke `Unreleased` pada PR user-facing, security, data migration, atau developer workflow yang relevan. Jangan mencatat refactor internal murni kecuali mengubah perilaku yang perlu diketahui pengguna/maintainer.
