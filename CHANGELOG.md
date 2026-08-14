# Changelog

Semua perubahan penting CBT-MAN didokumentasikan dalam file ini.

Format ini mengikuti prinsip [Keep a Changelog](https://keepachangelog.com/id/1.1.0/) dan menggunakan [Semantic Versioning](https://semver.org/lang/id/).

## [Unreleased]

### Added

- Tambahkan pedoman kontribusi, instruksi agen AI, dan template pull request untuk menjaga perubahan tetap fokus, tervalidasi, dan aman.
- Tambahkan gate CI CBT-MAN untuk kontrak PR, hygiene/artifact/branding, integritas generated route tree, dan parity Prisma migration-schema.
- Tambahkan dukungan Master Token (kode kustom), pengaturan batas waktu kedaluwarsa token (expireAt), opsi penyebaran token ke semua ujian, dan tabel klaim token (TokenClaim).

### Changed

### Fixed

### Security

- Terapkan validasi klaim token atomik di sisi server menggunakan model TokenClaim untuk memastikan token yang dapat digunakan kembali (reusable master token) tetap terikat secara aman pada otorisasi pengerjaan dan pembuatan sesi peserta.

### Deprecated

### Removed

## Catatan pemeliharaan

- Tambahkan item ke **Unreleased** bila perubahan memengaruhi pengguna, administrator, keamanan, data/migrasi, atau cara kontributor menjalankan proyek.
- Gunakan kalimat singkat, berorientasi dampak, dan sertakan nomor PR/issue bila tersedia: `- Perbaiki ... (#123)`.
- Jangan mencatat formatting/refactor internal murni kecuali perilaku atau risiko operasional ikut berubah.
- Saat membuat rilis, pindahkan item `Unreleased` ke heading versi bertanggal, misalnya `## [1.2.0] - 2026-08-09`.
