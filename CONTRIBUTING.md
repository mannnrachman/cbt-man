# Berkontribusi ke CBT-MAN

Terima kasih atas minat Anda berkontribusi pada **CBT-MAN**, aplikasi Computer-Based Test untuk pendidikan. Kontribusi bug fix, keamanan, aksesibilitas, test, dokumentasi, dan fitur yang memiliki kebutuhan nyata sangat diterima.

Dengan berkontribusi, Anda setuju menjaga komunikasi yang profesional, menghormati reviewer dan pengguna, serta tidak memasukkan data, kredensial, atau konten berhak cipta tanpa izin.

> **Sebelum mengubah kode, agen AI wajib membaca [`AGENTS.md`](./AGENTS.md) lalu [`CLAUDE.md`](./CLAUDE.md).**

## Sebelum Memulai

1. Baca [`README.md`](./README.md), [`CLAUDE.md`](./CLAUDE.md), dan [template PR](./.github/PULL_REQUEST_TEMPLATE.md).
2. Cari issue/PR yang **terbuka maupun tertutup** untuk memastikan pekerjaan tidak duplikat atau merupakan kelanjutan branch aggregate yang pernah ditolak.
3. Pastikan ada masalah atau kebutuhan nyata: jelaskan perilaku saat ini, dampaknya, dan hasil yang diharapkan.
4. Untuk perubahan arsitektur, domain Prisma, otorisasi, akses peserta, scoring, snapshot, token, atau session: buka issue/discussion dan sepakati desain terlebih dahulu.

## Setup Pengembangan

Prasyarat: Node.js 24 dan npm.

```bash
git clone https://github.com/<akun-anda>/cbt-man.git
cd cbt-man
npm ci
printf 'DATABASE_URL="file:./dev.db"\n' > .env  # SQLite lokal di prisma/dev.db
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

> Jangan commit `.env`, database SQLite lokal, file upload, log, atau artefak hasil test.

## Workflow Branch dan Pull Request

Mulai selalu dari `main` terbaru:

```bash
git fetch origin main
git switch -c <type>/<deskripsi-singkat> origin/main
```

Contoh nama branch:

```text
fix/token-claim-race
feat/exam-calculator
security/file-access-scope
docs/contribution-guide
```

Aturan utama:

- Satu PR = satu masalah atau fitur yang dapat direview secara mandiri.
- Jaga diff sekecil mungkin; jangan mencampur feature, redesign UI, refactor, dependency, dan perubahan domain yang tidak terkait.
- Jangan membuat PR baru di atas branch stale/aggregate/closed. Buat replacement branch bersih dari `main` terbaru dan referensikan kontribusi asal untuk kredit.
- Jangan force-push, menonaktifkan branch protection, meminta bypass `CI`, atau menghapus branch kontributor.
- Jangan merge PR yang konflik, dirty, belum memiliki `CI` pada head terbaru, atau masih memiliki review thread aktif.

## Keamanan, Otorisasi, dan Data

CBT-MAN menangani data peserta, bank soal, jawaban, token, dan sesi ujian. Karena itu:

- UI filtering bukan otorisasi. Terapkan role, ownership, dan scope pada server function/read boundary.
- Jangan menerima ID dari client sebagai bukti akses; verifikasi caller melalui helper server yang ada.
- Jangan mengekspos jawaban benar, pembahasan, skor internal, password hash, atau data peserta di luar scope.
- Jangan memakai full-record/generic upsert dari partial list/monitor projection untuk mutation sempit atau konkuren.
- Tangani race antara autosave, submit, force-submit, token, dan clear buffer pada boundary bersama.
- Jangan mengirim raw unexpected error kepada pengguna.

## Prisma dan Migrasi

Setiap perubahan di `prisma/schema.prisma` yang memengaruhi database wajib memiliki migration baru dan dapat dideploy.

- Jangan mengedit/menulis ulang migration yang sudah diterapkan.
- Jangan memakai `prisma db push` sebagai pengganti migration untuk perubahan yang akan dideploy.
- Untuk rename/drop/relation rewrite, sertakan backfill, preservasi data, perilaku orphan/null, dan test deploy.
- Jangan menghapus atau mengganti model domain besar dalam PR UI/feature kecil.

## File, Branding, dan Artifact yang Ditolak

Jangan masukkan file berikut ke PR:

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

Jangan mengembalikan branding/metadata lama: `CBT-Kampus`, `cbt-kampus`, `CBT-UNIVERSITAS`, atau `cbt-universitas`.

Jangan mengubah `src/routeTree.gen.ts` secara manual; file tersebut dibuat oleh TanStack Router dari `src/routes/`.

## Verifikasi Wajib

Sebelum membuka atau memperbarui PR, jalankan:

```bash
npm ci
npm run lint -- --max-warnings=7
npm run typecheck
npm run test:unit
npm run check:prisma
npm run build
```

Untuk perubahan Prisma:

```bash
npx prisma validate
npx prisma migrate deploy
npm run check:prisma
```

Untuk perubahan UI, uji alur yang diubah di browser termasuk loading/error state, keyboard, dan dark mode bila relevan.

CI hijau tidak cukup untuk menyatakan aman. Anda tetap harus memeriksa authorization, scope, migration, data preservation, privasi, dan concurrency yang disentuh perubahan.

## Commit dan Changelog

Gunakan commit kecil dan koheren, misalnya:

```text
feat: add optional exam calculator
fix: enforce participant file scope
docs: clarify contribution gates
test: cover token claim race
```

Perbarui [`CHANGELOG.md`](./CHANGELOG.md) pada bagian `Unreleased` bila perubahan memengaruhi pengguna, admin, keamanan, migration/data, atau workflow kontributor.

## Mengirim PR

1. Isi semua bagian template PR dengan jawaban faktual; jangan gunakan placeholder atau jawaban kosong.
2. Jelaskan masalah, scope, non-goal, risiko, dan validasi yang benar-benar dijalankan.
3. Sertakan screenshot atau rekaman untuk perubahan UI bila membantu review.
4. Setelah push, tunggu `CI` pada **head SHA terbaru**.
5. Baca dan tangani setiap review finding. Jika refuted/obsolete, berikan bukti teknis yang spesifik.
6. Jangan meminta merge sampai CI sukses, review thread selesai, dan branch bersih terhadap `main`.

## Pertanyaan dan Perubahan Besar

Buka issue terlebih dahulu bila Anda tidak yakin perubahan termasuk scope proyek, membutuhkan perubahan model database, atau berisiko terhadap integritas ujian. Lebih baik menyepakati desain kecil di awal daripada membuka PR besar yang harus ditutup.
