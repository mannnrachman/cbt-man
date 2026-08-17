# Changelog

Semua perubahan penting CBT-MAN didokumentasikan dalam file ini.

Format ini mengikuti prinsip [Keep a Changelog](https://keepachangelog.com/id/1.1.0/) dan menggunakan [Semantic Versioning](https://semver.org/lang/id/).

## [Unreleased]

### Added

- Tambahkan pilihan font SN Pro atau font sistem serta tema Neumorphism pada halaman Pengaturan admin (diekstrak dari #104).
- Tambahkan pedoman kontribusi, instruksi agen AI, dan template pull request untuk menjaga perubahan tetap fokus, tervalidasi, dan aman.
- Tambahkan gate CI CBT-MAN untuk kontrak PR, hygiene/artifact/branding, integritas generated route tree, dan parity Prisma migration-schema.
- Tingkatkan kalkulator ujian menjadi Kalkulator Ilmiah lengkap dengan fungsi trigonometri, logaritma, eksponensial, faktorial, memori kalkulator, dan unit test komprehensif.
- Tambahkan dukungan Master Token (kode kustom), pengaturan batas waktu kedaluwarsa token (expireAt), opsi penyebaran token ke semua ujian, dan tabel klaim token (TokenClaim).
- Tambahkan opsi `allowNilaiNormal` pada ujian: tabel rujukan nilai normal laboratorium opsional yang dapat dibuka peserta selama ujian (diekstrak dari #119).

### Changed

- Sederhanakan pengelolaan struktur akademik admin menjadi tab Fakultas, Program Studi, dan Kelas/Rombel (diekstrak dari #118).
- Rapikan jarak heading ke navbar, perlebar kontainer halaman peserta/ujian, dan bersihkan mesh gradient berlebih pada portal peserta (diekstrak dari #97).

### Fixed

- Perbaiki sintaks nilai arbitrer negatif Tailwind (`translate-y-[-0.5px]`, `top-[-40%]`) agar utilitas CSS ter-generate (diekstrak dari #98).
- Pindahkan inisialisasi pembuatan sesi ujian ke server-side (`createSesiServer`) dan perbaiki stale cache snapshot sebelum navigasi ke ruang ujian peserta.
- Satukan kalkulasi penilaian ujian (gradeAnswers dan gradeSesi) untuk memperhitungkan bobot poinBenar, poinSalah, dan poinKosong secara konsisten di client dan server.

### Security

- Terapkan validasi Zod discriminated union dan pemeriksaan integritas relasi sebelum penghapusan data induk akademik untuk mencegah orphaned records dan eksploitasi payload.
- Terapkan penegakan otorisasi server lengkap pada pembuatan sesi ujian (validasi kepesertaan, jadwal, rentang IP, dan token claim).
- Terapkan validasi klaim token atomik di sisi server menggunakan model TokenClaim untuk memastikan token yang dapat digunakan kembali tetap terikat aman pada otorisasi sesi.
- Terapkan penilaian otoritatif di sisi server saat pengumpulan ujian dan tutup celah race condition (TOCTOU) agar autosave tidak menimpa sesi yang telah diselesaikan pengawas.
- Redaksi kunci jawaban (`benar`) dan `pembahasan` dari snapshot peserta serta akses file pembahasan sampai sesi selesai dan ujian mempublikasikan detail hasil; persempit DTO jadwal ujian publik di landing page (temuan review #120).

### Deprecated

### Removed

## Catatan pemeliharaan

- Tambahkan item ke **Unreleased** bila perubahan memengaruhi pengguna, administrator, keamanan, data/migrasi, atau cara kontributor menjalankan proyek.
- Gunakan kalimat singkat, berorientasi dampak, dan sertakan nomor PR/issue bila tersedia: `- Perbaiki ... (#123)`.
- Jangan mencatat formatting/refactor internal murni kecuali perilaku atau risiko operasional ikut berubah.
- Saat membuat rilis, pindahkan item `Unreleased` ke heading versi bertanggal, misalnya `## [1.2.0] - 2026-08-09`.
