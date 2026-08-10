## Ringkasan

<!-- Jelaskan masalah nyata yang diselesaikan dan perubahan yang dibuat. -->

- Masalah / kebutuhan:
- Perubahan:
- Dampak pengguna/admin:

## Issue, PR terkait, dan riwayat

<!-- Cari PR/issue terbuka DAN tertutup sebelum membuka PR. -->

- Issue/PR terkait:
- Apakah ini replacement dari PR closed/stale? Jika ya, tulis nomor PR dan kontribusi yang diekstrak:
- Mengapa perubahan ini tidak duplikat dari pekerjaan yang ada?

## Scope dan non-goal

- Dalam scope:
- Tidak dalam scope:
- File penting yang diubah:

<!-- Satu PR = satu masalah/fitur. Jelaskan jika ada file yang tampak tidak terkait. -->

## Keamanan, otorisasi, dan data

<!-- Isi semua yang relevan. Jangan hapus bagian ini. -->

- [ ] Tidak menyentuh data privat, otorisasi, token, file, sesi, score, atau snapshot.
- [ ] Server-side caller/role/ownership/scope telah diperiksa untuk setiap boundary yang disentuh.
- [ ] Tidak ada UI-only authorization atau client-supplied ID yang dipercaya sebagai bukti akses.
- [ ] Tidak ada jawaban benar, pembahasan, password hash, atau data peserta di luar scope yang terekspos.
- [ ] Mutation sempit tidak memakai generic/full-record upsert dari partial list/monitor projection.
- [ ] Tidak relevan — jelaskan:

## Prisma dan migrasi

- [ ] Tidak mengubah `prisma/schema.prisma`.
- [ ] Mengubah schema dan menambahkan migration baru di `prisma/migrations/`.
- [ ] Migration additive/data-preserving; rename/drop/relation rewrite memiliki backfill dan preflight data.
- [ ] `npx prisma validate` dan `npx prisma migrate deploy` telah dijalankan.
- [ ] Tidak relevan — jelaskan:

<!-- Jangan gunakan prisma db push sebagai pengganti migration deployable. -->

## UI dan aksesibilitas

- [ ] Tidak mengubah UI.
- [ ] Alur UI diuji manual, termasuk loading/error state.
- [ ] Kontrol interaktif memakai semantic/native control atau komponen aksesibel.
- [ ] Keyboard, label/aria, dark mode, dan timezone/hydration telah diperiksa bila relevan.
- [ ] Screenshot/rekaman terlampir atau tidak diperlukan karena:

## Validasi yang benar-benar dijalankan

```text
[ ] npm ci
[ ] npm run lint -- --max-warnings=7
[ ] npm run typecheck
[ ] npm run test:unit
[ ] npm run build
[ ] npx prisma validate
[ ] npx prisma migrate deploy
[ ] npm run check:prisma
[ ] Test/manual check tambahan:
```

<!-- Cantumkan hasil, command tambahan, dan kegagalan/flaky test secara jujur. -->

## Hygiene check

- [ ] Diff tidak memuat `scratch/**`, `ts_errors.txt`, `diff_users.txt`, raw/temp file, upload, database lokal, log, coverage, artifact, atau generated output.
- [ ] Tidak mengubah package name, lockfile metadata, atau dependency tanpa alasan feature yang jelas.
- [ ] Tidak mengembalikan branding `cbt-kampus` / `cbt-universitas`.
- [ ] Tidak mengedit `src/routeTree.gen.ts` secara manual.
- [ ] `git diff --check` bersih.
- [ ] Branch dibuat dari `main` terbaru dan tidak membawa commit aggregate/stale yang tidak terkait.

## Risiko dan rollback

- Risiko yang tersisa:
- Rencana rollback/recovery bila perubahan gagal:
- Changelog `Unreleased` diperbarui / tidak diperlukan karena:

## Checklist pengirim

- [ ] Saya membaca `CONTRIBUTING.md`, `AGENTS.md`, dan `CLAUDE.md`.
- [ ] Saya membaca seluruh template ini dan mengisi jawaban spesifik, bukan placeholder.
- [ ] Saya siap menangani CI dan seluruh review thread pada head SHA terbaru.
- [ ] Saya tidak meminta bypass CI, branch protection, atau merge sebelum review selesai.
