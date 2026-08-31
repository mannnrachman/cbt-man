# SDD — Workflow Akademik, Bank Soal, dan Ujian CBT-MAN

Status: Proposed
Tanggal: 2026-08-23
Sumber kajian: Council domain, correctness, migration-risk, dan chair review

## 1. Keputusan

CBT-MAN memisahkan tiga domain yang saat ini masih bercampur:

```text
AKADEMIK
Katalog Mata Kuliah
        ↓
Penawaran Mata Kuliah
(mata kuliah + periode + kelas + pengampu + peserta)

KONTEN
Mata Kuliah
        ↓
Topik
        ↓
Soal
        └── Modul/Kelompok Materi (opsional)

PELAKSANAAN
Penawaran Mata Kuliah
        ↓
Paket Ujian
        ↓
Publikasi
        ↓
Sesi Peserta
        ↓
Evaluasi
```

Keputusan inti:

1. `MataKuliah` adalah katalog permanen dan tidak terikat langsung pada satu semester.
2. Konteks semester, kelas, pengampu, dan peserta ditempatkan pada `PenawaranMataKuliah`.
3. `Topik` wajib dimiliki langsung oleh satu `MataKuliah`.
4. `Modul` tidak dihapus langsung. Modul menjadi kelompok materi opsional, bukan sumber kebenaran untuk kepemilikan, otorisasi, atau pemilihan soal.
5. Satu paket ujian berasal dari satu penawaran mata kuliah dan hanya boleh mengambil topik mata kuliah tersebut.
6. Paket mempunyai lifecycle eksplisit minimal `DRAFT` dan `PUBLISHED`.
7. Assignment peserta bersifat eksplisit dan deny-by-default. Assignment kosong tidak berarti semua peserta.
8. Publikasi menjalankan readiness check. Validasi tidak ditunda sampai peserta mulai.
9. Sesi membekukan soal, opsi, skema penilaian, urutan, dan batas waktu agar perubahan bank soal tidak mengubah ujian berjalan.
10. Policy server yang sama dipakai oleh snapshot, direct fetch, mutation, start/resume, evaluasi, dan laporan.

## 2. Masalah Saat Ini

### 2.1 Domain bercampur

- `MataKuliah` terikat langsung ke satu `Semester`, sehingga katalog dan pelaksanaan periodik tidak terpisah.
- `Ujian` memilih `MataKuliah` dan `Semester` secara independen; kombinasi yang tidak cocok tetap dapat disimpan.
- `UnitAkademik` dipakai sekaligus sebagai organisasi, kelas, dan grup assignment.
- Peserta hanya mempunyai satu `unitId`; tidak ada enrollment mata kuliah/kelas kuliah.

### 2.2 Hierarki konten tidak memiliki invariant kuat

- `Modul.mataKuliahId` nullable dan bukan foreign key Prisma.
- Paket memilih `Topik` secara langsung; Modul tidak digunakan pada pemilihan soal, sesi, skoring, atau evaluasi.
- UI hanya memprioritaskan topik dari mata kuliah paket, tetapi tetap mengizinkan topik mata kuliah lain.
- `topicSets` disimpan sebagai JSON sehingga referensi topik dan duplikasi sumber tidak dijaga database.

### 2.3 Lifecycle paket tidak eksplisit

- Paket tanpa jadwal dianggap terbuka.
- Assignment kosong berarti semua peserta.
- Tidak ada perbedaan domain antara draft belum lengkap dan paket siap dijalankan.
- Kecukupan bank soal baru diperiksa ketika peserta mulai.
- Editor saat ini tidak menyediakan pengaturan jadwal walaupun model memiliki `beginAt` dan `endAt`.

### 2.4 Sesi belum immutable

- Sesi menyimpan ID soal, bukan snapshot isi soal dan aturan skoring.
- Perubahan atau penghapusan soal setelah sesi dimulai dapat mengubah tampilan, validasi, atau nilai.
- Sumber soal tumpang tindih dapat memilih soal yang sama lebih dari sekali.
- Start session belum dilindungi unique constraint peserta–ujian.

## 3. Temuan Penghambat

Redesign domain tidak boleh dimulai sebelum temuan berikut ditutup melalui PR terpisah.

### P0 — keamanan

1. Snapshot peserta mengirim kode token ujian.
2. Snapshot operator dengan scope Mata Kuliah dapat menerima seluruh bank soal/kunci karena semantik scope tidak konsisten.
3. Mutation soal tidak menunggu pemeriksaan scope asynchronous.

### P1 — integritas pelaksanaan

1. Auto-submit setelah timeout ditolak server karena request tiba setelah `endsAt`.
2. Draft belum tersedia dan paket kosong dapat terbuka kepada peserta.
3. Skor tetap terkirim ketika `showResult=false`.
4. Token mempunyai dua sumber kebenaran yang tidak konsisten.
5. Skor essay dan hak mutation sesi belum dibatasi cukup sempit di server.
6. Sesi belum immutable dan pembuatan sesi konkuren dapat menghasilkan duplikasi.
7. Validasi lokal yang mewajibkan sumber soal bertentangan dengan alur pembuatan draft kosong. Draft harus boleh disimpan; publish yang harus ditolak.

## 4. Invariant Target

### 4.1 Akademik

- Satu `MataKuliah` dapat ditawarkan berkali-kali pada periode berbeda.
- Satu `PenawaranMataKuliah` memiliki tepat satu Mata Kuliah dan satu periode akademik.
- Kelas/peserta ujian berasal dari enrollment atau assignment eksplisit.
- Organisasi akademik tidak otomatis menjadi grup peserta tanpa aturan turunan yang eksplisit.

### 4.2 Konten

- Setiap Topik aktif memiliki satu `mataKuliahId` valid.
- `modulId` opsional dan tidak menentukan akses.
- Soal tetap dimiliki satu Topik.
- Penghapusan Mata Kuliah, Topik, atau Modul tidak boleh diam-diam merusak paket/sesi historis.

### 4.3 Paket ujian

- Draft dapat disimpan walaupun belum lengkap dan tidak terlihat peserta.
- Publish hanya berhasil jika penawaran, sumber soal, jumlah soal, peserta, durasi, jadwal, token, dan policy hasil valid.
- Baseline melarang topik lintas mata kuliah.
- Sumber soal harus unik atau menghasilkan himpunan soal unik.
- Setelah published, perubahan yang memengaruhi soal, peserta, waktu, atau skoring dibatasi; setelah sesi pertama dibuat, perubahan tersebut dilarang atau menghasilkan revisi baru.

### 4.4 Sesi dan evaluasi

- Satu peserta hanya mempunyai satu sesi per paket.
- `endsAt = min(mulaiAt + durasi, batas akhir paket)`.
- Timeout menyimpan jawaban terakhir dan menutup sesi secara idempotent.
- Snapshot sesi menjaga auditabilitas isi soal dan nilai.
- Penilaian objektif dan essay divalidasi server-side.
- Data hasil hanya dikirim jika policy publikasi hasil mengizinkan.

## 5. Model Konseptual Target

Nama final dan detail kolom diputuskan pada desain schema Fase 3.

```text
MataKuliah
  ├── Topik
  │     └── Soal
  └── Modul? ── Topik

PeriodeAkademik
  └── PenawaranMataKuliah
        ├── MataKuliah
        ├── Kelas/Pengampu
        ├── Enrollment
        └── Ujian
              ├── SumberSoal
              ├── Assignment
              └── SesiUjian
```

Relasi baru harus additive. ID Topik, Soal, Jawaban, Ujian, dan Sesi lama wajib dipertahankan.

## 6. Workflow Target

1. Admin menyiapkan katalog Mata Kuliah.
2. Admin membuat Topik dan Soal; Modul dapat dipakai sebagai folder opsional.
3. Admin membuat Penawaran Mata Kuliah untuk periode dan kelas tertentu.
4. Admin membuat Paket Ujian sebagai draft dari penawaran tersebut.
5. Sistem hanya menawarkan Topik dari Mata Kuliah yang sama.
6. Admin memilih sumber dan aturan pengambilan soal, jadwal, peserta, token, serta policy hasil.
7. Admin menjalankan readiness check lalu publish.
8. Peserta yang assigned melihat paket sesuai jadwal.
9. Saat mulai, server membuat satu sesi dan snapshot soal secara atomik.
10. Submit atau timeout menutup sesi secara idempotent.
11. Soal objektif dinilai otomatis; essay masuk antrean evaluator.
12. Hasil dan pembahasan hanya dibuka sesuai policy paket.

## 7. Strategi Implementasi

### Fase 0 — Baseline

Outcome: SDD disepakati; redesign schema dibekukan.

Gate:

- Mulai dari `main` terbaru.
- Satu issue/branch/PR untuk satu masalah.
- Perubahan lokal yang belum disetujui tidak dianggap baseline.

### Fase 1 — Tutup P0

PR terpisah:

1. Hapus token dari snapshot peserta dan tambah test regresi.
2. Satukan policy scope Mata Kuliah/Topik untuk snapshot, fetch, dan mutation.
3. Perbaiki `await` pada otorisasi mutation soal dan tambah authorization test.

Gate: tidak ada P0 terbuka dan authorization matrix lulus.

### Fase 2 — Stabilkan lifecycle dan sesi

PR terpisah:

1. Tambahkan `DRAFT/PUBLISHED` dan jadikan assignment kosong tertutup.
2. Buat readiness check server-side dan UI publikasi.
3. Perbaiki timeout-submit agar idempotent.
4. Satukan model token.
5. Batasi mutation sesi/evaluasi dan redaksi hasil.
6. Cegah source/soal duplikat dan concurrent session.
7. Tambahkan snapshot/versi soal untuk sesi immutable.

Gate: integration test publish/access, timeout, token, scoring, concurrent start, dan immutability lulus.

### Fase 3 — Kunci desain domain dan preflight

Outcome:

- Semantik katalog, penawaran, enrollment, scope, token, dan revisi paket disetujui.
- Tersedia laporan jumlah Modul tanpa Mata Kuliah, referensi dangling, dan Topik yang tidak dapat di-backfill.
- Format bank/backup v2 dan kompatibilitas v1 dirancang.

Gate: tidak ada data yang perlu ditebak atau dihapus pada migrasi.

### Fase 4 — Migrasi additive

1. Tambahkan `Topik.mataKuliahId` nullable dengan foreign key.
2. Backfill hanya dari `Modul.mataKuliahId` yang valid.
3. Terapkan dual-read/dual-write sementara.
4. Pindahkan policy akses ke kepemilikan Topik langsung.
5. Perbarui snapshot, import/export, backup/restore, seed, dan test.
6. Tambahkan Penawaran Mata Kuliah dan assignment/enrollment secara additive.

Gate:

- Fresh migration dan upgrade fixture database lama lulus.
- Tidak ada ID historis berubah.
- Orphan dilaporkan dan diselesaikan eksplisit.
- Import bank v1 serta round-trip bank/backup v2 lulus.

### Fase 5 — Aktifkan workflow target

1. Ubah UI utama menjadi `Mata Kuliah → Topik → Soal`.
2. Tampilkan Modul sebagai kelompok opsional.
3. Buat paket dari Penawaran Mata Kuliah.
4. Filter sumber soal secara ketat ke Mata Kuliah paket.
5. Ambil peserta dari assignment/enrollment.
6. Aktifkan readiness check dan publish.

Gate: browser test admin–peserta dan seluruh gate proyek lulus.

### Fase 6 — Retire kompatibilitas lama

- Jadikan `modulId` nullable setelah semua pembaca tidak lagi bergantung kepadanya.
- Hentikan fallback lama setelah masa kompatibilitas backup/import selesai.
- Penghapusan tabel Modul, jika tetap diperlukan, membutuhkan SDD dan PR terpisah.

## 8. Strategi Validasi

Minimal test yang harus tersedia:

- Authorization matrix untuk super admin, admin prodi, evaluator, dan peserta.
- Snapshot tidak membocorkan token, kunci, pembahasan, atau nilai tersembunyi.
- Draft tidak muncul dan tidak dapat dimulai melalui direct request.
- Readiness check mendeteksi sumber invalid, soal kurang, duplikasi, assignment kosong, dan jadwal invalid.
- Auto-submit timeout menyimpan jawaban terakhir tepat sekali.
- Concurrent start menghasilkan satu sesi.
- Perubahan bank soal tidak mengubah sesi yang sudah terbentuk.
- Migrasi fresh dan upgrade database lama menjaga ID dan relasi historis.
- Import bank v1, bank v2, backup v2, dan restore berjalan atomik.
- Laporan memakai Mata Kuliah dan penawaran yang benar.

Gate proyek tetap mengikuti `CLAUDE.md`, termasuk lint, typecheck, unit test, build, Prisma validate, migration deploy pada database fresh, dan `check:prisma` bila relevan.

## 9. Keputusan yang Masih Terbuka

Keputusan berikut harus dijawab sebelum Fase 3 selesai:

1. Apakah Modul dibutuhkan untuk RPS/CPMK/blok pembelajaran atau hanya folder?
2. Apakah ujian lintas mata kuliah benar-benar diperlukan? Baseline: tidak.
3. Apakah scope Topik dan Mata Kuliah memakai union, intersection, atau override?
4. Apakah token sekali pakai per peserta, reusable, atau token ruang?
5. Apakah kelas menjadi tipe UnitAkademik atau entitas khusus?
6. Apakah perubahan paket published membuat revisi baru atau hanya dikunci setelah sesi pertama?
7. Berapa lama kompatibilitas bank/backup v1 dipertahankan?

## 10. Non-goal

- Tidak menghapus Modul pada tahap awal.
- Tidak menormalisasi seluruh JSON relation dalam satu PR.
- Tidak mencampur redesign UI, schema, authorization, import, dan backup dalam satu perubahan.
- Tidak mendukung ujian lintas mata kuliah sebelum ada requirement dan SDD khusus.
- Tidak mengubah data orphan dengan tebakan otomatis.
