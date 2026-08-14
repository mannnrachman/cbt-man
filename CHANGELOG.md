# Changelog

Semua perubahan penting CBT-MAN didokumentasikan dalam file ini.

Format ini mengikuti prinsip [Keep a Changelog](https://keepachangelog.com/id/1.1.0/) dan menggunakan [Semantic Versioning](https://semver.org/lang/id/).

## [Unreleased]

### Added

- Tambahkan pedoman kontribusi, instruksi agen AI, dan template pull request untuk menjaga perubahan tetap fokus, tervalidasi, dan aman.
- Tambahkan gate CI CBT-MAN untuk kontrak PR, hygiene/artifact/branding, integritas generated route tree, dan parity Prisma migration-schema.

### Changed

### Fixed

- Satukan kalkulasi penilaian ujian (gradeAnswers dan gradeSesi) untuk memperhitungkan bobot poinBenar, poinSalah, dan poinKosong secara konsisten di client dan server.

### Security

- Terapkan penilaian otoritatif di sisi server saat pengumpulan ujian dan tutup celah race condition (TOCTOU) pada penyimpanan sesi agar autosave peserta tidak dapat menimpa sesi yang telah diselesaikan oleh pengawas.

### Deprecated

### Removed

## Catatan pemeliharaan

- Tambahkan item ke **Unreleased** bila perubahan memengaruhi pengguna, administrator, keamanan, data/migrasi, atau cara kontributor menjalankan proyek.
- Gunakan kalimat singkat, berorientasi dampak, dan sertakan nomor PR/issue bila tersedia: `- Perbaiki ... (#123)`.
- Jangan mencatat formatting/refactor internal murni kecuali perilaku atau risiko operasional ikut berubah.
- Saat membuat rilis, pindahkan item `Unreleased` ke heading versi bertanggal, misalnya `## [1.2.0] - 2026-08-09`.
