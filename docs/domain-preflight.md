# Preflight Migrasi Domain Akademik

`npm run check:domain-preflight` adalah pemeriksaan read-only sebelum Fase 4 migrasi domain.

Pemeriksaan ini tidak melakukan backfill atau penghapusan data. Exit code `1` berarti masih ada temuan `blocking` yang harus diselesaikan secara eksplisit. Temuan `review` tidak selalu menghalangi migration, tetapi harus dicatat dalam rencana kompatibilitas.

Kategori utama:

- `module_without_course`: Modul tanpa `mataKuliahId`; kepemilikan Topik tidak dapat ditebak.
- `duplicate_exam_source` dan `cross_course_exam_source`: paket yang belum aman dimigrasikan ke sumber Topik langsung.
- `duplicate_session`: unique constraint peserta–ujian belum aman diterapkan.
- `legacy_token_without_claim`: data token lama belum masuk ke `TokenClaim`.
- `legacy_session_without_snapshot`: sesi lama masih bergantung pada bank soal aktif.
