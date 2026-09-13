# Changelog

Semua perubahan penting CBT-MAN didokumentasikan dalam file ini.

Format ini mengikuti prinsip [Keep a Changelog](https://keepachangelog.com/id/1.1.0/) dan menggunakan [Semantic Versioning](https://semver.org/lang/id/).

## [Unreleased]

### Added

### Changed

### Fixed

### Security

### Deprecated

### Removed

## [0.1.1] - 2026-09-13

Patch snapshot setelah antrian audit #150–#156 dan keputusan mesin #159 merapat ke `main`. Ini **bukan** klaim siap produksi.

Yang dikerjakan sejak `v0.1.0`:

- **#153 / #160** — jejak audit, restore/reset satu alur, readiness tanpa membocorkan dependensi, metadata `jurusanId` pada backup.
- **#151 / #163** — dialog konfirmasi admin yang dapat diakses; `aria-label` pada toolbar ikon RichEditor (F-17).
- **#152 / #164** — ambang login gagal 5 percobaan / 10 menit; kuota hanya bertambah setelah gagal (F-03).
- **#150 / #165** — baca file langsung operator ter-scope jurusan dan topik/mata kuliah (F-08).
- **#151 / #166** — rollback cache (dan UI bila belum ada edit baru) segera setelah autosave peserta gagal (F-14).
- **#154 / #167** — ignore `.zed/`, `scratch/`, `data/uploads/`; cabut media lokal yang sempat ter-commit (F-01).
- **#155 / #168** — monitor live menyelesaikan `operatorCanTouchUjian` sekali per ujian unik (F-15).
- **#156 / #169** — batalkan copy/cut/paste/klik kanan di halaman kerjakan bila `blokirShortcut` (F-23).
- **#159 / #170** — README: SQLite single-node sekarang; target berikutnya PostgreSQL, bukan MySQL.

Sengaja belum masuk: snapshot penuh (F-06), normalisasi JSON (F-18), Playwright (F-10), freeze PRD (F-21), alarm/force-logout ujian (F-22/F-24/F-25), hop PostgreSQL, pengukuran WAL, dan beberapa batas upload/audit dependensi.

### Added

### Changed

- Catat keputusan persistensi: SQLite single-node untuk production sekarang; target client/server berikutnya PostgreSQL, bukan MySQL (#159, #170).

### Fixed

- Batalkan copy, cut, paste, dan menu klik kanan di halaman kerjakan saat sesi `sedang` dan `blokirShortcut` aktif (#156, #169).
- Batch pemeriksaan scope operator pada monitor live sekali per ujian unik, bukan per sesi aktif (#155, #168).
- Abaikan `.zed/`, `scratch/`, dan `data/uploads/` di working tree, dan cabut media lokal yang sempat ter-commit (#154, #167).
- Kembalikan potongan sesi cache (dan UI bila belum ada edit baru) segera setelah autosave peserta gagal, tanpa menunggu hydrate penuh (#151, #166).
- Ganti konfirmasi destruktif admin dari `confirm()` native ke dialog bersama yang dapat diakses, dan tambahkan `aria-label` pada toolbar ikon RichEditor (#151, #163).
- Jangan hapus cookie logout bila sesi server gagal dihapus; audit mutation pengguna wajib; baca media tidak diblokir lock restore; cleanup folder restore bersifat best-effort (#153, #160).
- Catat keberhasilan restore/reset dalam transaksi yang sama dan batasi respons readiness publik tanpa detail dependensi (#153, #160).
- Jadikan restore database dan media satu alur yang tervalidasi, menghapus media stale, dan mengembalikan folder lama saat promosi gagal (#153, #160).
- Lindungi mutation audit, token, sesi, pengguna, akademik, modul, dan ujian dengan audit precondition yang eksplisit (#153, #160).

### Security

- Terapkan scope jurusan dan topik/mata kuliah pada pembacaan file langsung operator, sama seperti daftar file dan operasi server lain (#150, #165).
- Batasi login gagal menjadi 5 percobaan per 10 menit dan hanya catat kegagalan, bukan percobaan yang masih dicek atau yang berhasil (#152, #164).
- Pertahankan metadata `jurusanId` saat backup/restore, serialisasi operasi file, dan cadangkan ekstensi `.json` untuk metadata internal (#153, #160).

### Deprecated

### Removed

## [0.1.0] - 2026-09-10

Rilis awal: snapshot bertanda dari `main`, bukan klaim siap produksi. Issue audit #150–#156 masih terbuka.

### Added

- Tambahkan cuplikan layar landing, login, dasbor admin, paket ujian, bank soal, dan portal peserta pada README (#157).
- Tambahkan aturan satu PR aktif per kontributor dan penggunaan CodeRabbit pada head final untuk mengurangi fragmentasi review (#146).
- Tambahkan pilihan font SN Pro atau font sistem serta tema Neumorphism pada halaman Pengaturan admin (diekstrak dari #104).
- Tambahkan pedoman kontribusi, instruksi agen AI, dan template pull request untuk menjaga perubahan tetap fokus, tervalidasi, dan aman.
- Tambahkan gate CI CBT-MAN untuk kontrak PR, hygiene/artifact/branding, integritas generated route tree, dan parity Prisma migration-schema.
- Tingkatkan kalkulator ujian menjadi Kalkulator Ilmiah lengkap dengan fungsi trigonometri, logaritma, eksponensial, faktorial, memori kalkulator, dan unit test komprehensif.
- Tambahkan dukungan Master Token (kode kustom), pengaturan batas waktu kedaluwarsa token (expireAt), opsi penyebaran token ke semua ujian, dan tabel klaim token (TokenClaim).
- Tambahkan opsi `allowNilaiNormal` pada ujian: tabel rujukan nilai normal laboratorium opsional yang dapat dibuka peserta selama ujian (diekstrak dari #119).

### Changed

- Perjelas form pembuatan modul bank soal dan sederhanakan toolbar menjadi search bar saja (#147).
- Perbarui header dan layout editor paket ujian admin agar menggunakan ruang layar lebih luas serta menampilkan ringkasan total soal; tambahkan akses Kelola Token untuk semua status ujian, render nested route token, dan rapikan halaman token (#130).
- Sederhanakan pengelolaan struktur akademik admin menjadi tab Fakultas, Program Studi, dan Kelas/Rombel (diekstrak dari #118).
- Rapikan jarak heading ke navbar, perlebar kontainer halaman peserta/ujian, dan bersihkan mesh gradient berlebih pada portal peserta (diekstrak dari #97).

### Fixed

- Sembunyikan aksi hapus file dari operator karena endpoint penghapusan hanya menerima super admin (#145).
- Jaga polling sesi tetap berjalan saat jawaban berubah, tampilkan status pemulihan saat polling gagal, dan cegah respons spesifik pengguna disimpan oleh cache (#138).
- Kurangi polling ruang ujian peserta menjadi pembacaan status sesi sempit tanpa memuat snapshot seluruh database, dan cegah respons polling stale menurunkan deadline (#137).
- Sinkronkan ulang data kelas setelah mutation server dan gunakan update keanggotaan yang terlindungi agar UI tidak menyimpan state lokal yang stale (#134).
- Tolak `topicSets` legacy yang malformed sebelum remediation menulis data, gunakan ownership topik langsung, dan cegah update penawaran menimpa membership concurrent (#133).
- Perbaiki sintaks nilai arbitrer negatif Tailwind (`translate-y-[-0.5px]`, `top-[-40%]`) agar utilitas CSS ter-generate (diekstrak dari #98).
- Perbaiki label tombol pembuka modal login landing menjadi "Login Peserta" dan render jawaban essay hasil ujian sebagai plain text (diekstrak dari #120).
- Pindahkan inisialisasi pembuatan sesi ujian ke server-side (`createSesiServer`) dan perbaiki stale cache snapshot sebelum navigasi ke ruang ujian peserta.
- Satukan kalkulasi penilaian ujian (gradeAnswers dan gradeSesi) untuk memperhitungkan bobot poinBenar, poinSalah, dan poinKosong secara konsisten di client dan server.

### Security

- Perbarui dependensi sanitizer, import Word, dan build melalui lockfile; gunakan override `deepmerge-ts@8.0.0` khusus `@prisma/config@6.19.3` untuk menutup GHSA-ggr8-5vv4-36mx tanpa mengganti versi Prisma. Override perlu ditinjau ulang ketika Prisma diperbarui; sertakan tes objek melingkar dan pemuatan konfigurasi.
- Wajibkan `ADMIN_PASSWORD` saat seed production agar akun admin tidak dibuat dengan password acak yang tidak dapat dipulihkan operator (#144).
- Sembunyikan kredensial akun demo dari halaman login admin pada build production (#143).
- Hapus endpoint daftar ujian penuh yang tidak digunakan agar tidak menjadi permukaan baca di luar scope operator (#142).
- Perbarui SheetJS ke 0.20.3 untuk menutup prototype pollution dan ReDoS saat membaca file Excel buatan khusus (#141).
- Batasi endpoint daftar modul dan topik untuk pengaturan role hanya kepada super admin (#140).
- Tolak akses operator ketika data scope topik atau mata kuliah rusak atau bukan array string, alih-alih memperlakukannya sebagai akses tanpa batas.
- Tutup bypass status published melalui upsert, samakan otorisasi peserta pada fetch/file/snapshot, redaksi metadata nilai server-side, dan batasi submit terlambat dengan grace period.
- Kunci perubahan kelas mata kuliah setelah ujian dipublikasikan/berjalan, serta jaga sinkronisasi kepemilikan mata kuliah antara modul dan topik.

- Batasi autosave dan submit peserta ke mutation jawaban khusus yang memvalidasi sesi, soal, dan opsi dari database serta menolak full-record session upsert.
- Terapkan validasi Zod discriminated union dan pemeriksaan integritas relasi sebelum penghapusan data induk akademik untuk mencegah orphaned records dan eksploitasi payload.
- Terapkan penegakan otorisasi server lengkap pada pembuatan sesi ujian (validasi kepesertaan, jadwal, rentang IP, dan token claim).
- Terapkan validasi klaim token atomik di sisi server menggunakan model TokenClaim untuk memastikan token yang dapat digunakan kembali tetap terikat aman pada otorisasi sesi.
- Terapkan penilaian otoritatif di sisi server saat pengumpulan ujian dan tutup celah race condition (TOCTOU) agar autosave tidak menimpa sesi yang telah diselesaikan pengawas.
- Redaksi kunci jawaban (`benar`) dan `pembahasan` dari snapshot peserta serta akses file pembahasan sampai sesi selesai dan ujian mempublikasikan detail hasil; persempit DTO jadwal ujian publik di landing page (temuan review #120).
- Perketat scope update paket ujian, pisahkan snapshot soal per sesi, dan tolak overwrite anggota kelas dari state klien yang stale (#132).

### Deprecated

### Removed

## Catatan pemeliharaan

- Tambahkan item ke **Unreleased** bila perubahan memengaruhi pengguna, administrator, keamanan, data/migrasi, atau cara kontributor menjalankan proyek.
- Gunakan kalimat singkat, berorientasi dampak, dan sertakan nomor PR/issue bila tersedia: `- Perbaiki ... (#123)`.
- Jangan mencatat formatting/refactor internal murni kecuali perilaku atau risiko operasional ikut berubah.
- Saat membuat rilis, pindahkan item `Unreleased` ke heading versi bertanggal, misalnya `## [1.2.0] - 2026-08-09`.

[Unreleased]: https://github.com/mannnrachman/cbt-man/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/mannnrachman/cbt-man/releases/tag/v0.1.1
[0.1.0]: https://github.com/mannnrachman/cbt-man/releases/tag/v0.1.0
