# AGENTS.md — CBT-MAN

Jika Anda agen AI atau alat otomatis, baca **seluruh** [`CLAUDE.md`](./CLAUDE.md) sebelum membaca, mengubah, atau mengusulkan kode.

Dokumen tersebut adalah sumber aturan implementasi, keamanan, migrasi, validasi, dan pull request untuk CBT-MAN. [`CONTRIBUTING.md`](./CONTRIBUTING.md) berlaku untuk semua kontributor, termasuk agen AI.

## Ringkasan aturan yang tidak boleh dilanggar

1. Mulai dari `main` terbaru dan kerjakan **satu masalah atau fitur per branch/PR**.
2. Jangan membuka PR aggregate, membawa kembali commit/branch yang sudah ditolak, atau mencampur UI, refactor, dependency, dan fitur yang tidak berkaitan.
3. Jangan mengandalkan pembatasan UI untuk otorisasi. Semua read/mutation sensitif harus memverifikasi caller, role, ownership, dan scope di server.
4. Jangan mengubah Prisma schema tanpa migration additive yang dapat dideploy dan rencana preservasi data.
5. Jangan mengedit `src/routeTree.gen.ts` secara manual.
6. Jangan menambahkan artifact, file scratch, data upload, error dump, atau branding lama.
7. Jalankan seluruh gate lokal, termasuk `npm run check:prisma` saat gate database relevan, lalu tunggu `CI` serta review yang relevan sebelum menyatakan PR siap merge.
8. Jangan force-push, menghapus branch kontributor, menonaktifkan branch protection, atau meminta maintainer mengabaikan CI/review.

Sebelum membuka PR, baca seluruh [template PR](./.github/PULL_REQUEST_TEMPLATE.md) dan isi dengan bukti spesifik. Jika tidak dapat menjawab template dengan fakta, jangan buka PR.
