# CBT-MAN Upgrade

Aplikasi **Computer-Based Test (CBT)** untuk sekolah, dibangun dengan **TanStack Start + React + TypeScript + Prisma + SQLite**.

Project ini berfokus pada simulasi sistem CBT sekolah yang terasa nyata untuk kebutuhan:
- preview produk
- pengembangan fitur admin/peserta
- uji alur ujian end-to-end
- eksperimen migrasi dari penyimpanan lokal menuju persistence berbasis server

Saat ini project sudah memiliki **seed dummy realistis** dengan konteks sekolah Indonesia, sehingga dashboard admin, operator/guru, dan peserta bisa langsung dipakai untuk demo.

---

## Fitur Utama

- **Manajemen bank soal** berbasis `Modul → Topik → Soal`
- Dukungan beberapa **tipe soal**:
  - pilihan ganda (`pg`)
  - multi jawaban (`multi`)
  - benar/salah (`bs`)
  - essay (`essay`)
- **Manajemen ujian** dengan:
  - durasi
  - aturan skor benar/salah/kosong
  - token ujian
  - pembatasan grup peserta
  - pengacakan soal dan jawaban
  - fullscreen wajib
  - deteksi pindah tab / anti-cheat dasar
- **Sesi ujian peserta** dengan status:
  - belum
  - sedang
  - selesai
  - kedaluwarsa
- **Penilaian essay manual** oleh admin/operator
- **Hasil, evaluasi, laporan, leaderboard**, dan monitoring peserta
- **Persistence server-side** menggunakan Prisma + SQLite
- **Dummy dataset realistis** untuk preview lokal tanpa setup manual panjang

---

## Stack

### Frontend
- [TanStack Start](https://tanstack.com/start)
- React 19
- TypeScript
- Tailwind CSS 4
- Radix UI
- Zustand

### Backend / Persistence
- Prisma
- SQLite
- TanStack server functions

### Tooling
- Vite
- ESLint
- Prettier

---

## Status Arsitektur Saat Ini

Project ini memakai pendekatan **hybrid transitional architecture**:

- **data utama CBT disimpan di server** melalui Prisma + SQLite
- UI masih memakai **client-side repository/cache facade** di `src/lib/cbt/repos.ts`
- mutasi data dilakukan secara **optimistic update** di cache, lalu dipersist ke server secara async

Artinya:
- project ini **bukan lagi localStorage-only** untuk data inti
- tapi juga **belum full server-driven per route**

Pendekatan ini dipilih agar migrasi dari arsitektur lama tetap bertahap sambil menjaga UI tetap berjalan.

---

## Domain Data

Model utama saat ini mencakup:

- `Group`
- `User`
- `Modul`
- `Topik`
- `Soal`
- `Jawaban`
- `Ujian`
- `TokenUjian`
- `SesiUjian`
- `AppConfig`

Skema Prisma ada di:
- `prisma/schema.prisma`

---

## Seeder Dummy Realistis

Seeder sudah di-upgrade agar seluruh preview aplikasi terasa seperti sistem sekolah nyata.

Cakupan seed saat ini:
- beberapa **kelas/grup**
- akun **admin**, **operator**, **guru**, dan **peserta**
- modul Matematika, Fisika, dan Biologi
- topik-topik turunan yang relevan
- soal objektif + essay
- beberapa ujian dengan konfigurasi berbeda
- token ujian aktif/nonaktif
- sesi peserta dengan kondisi beragam:
  - belum mulai
  - sedang mengerjakan
  - selesai
  - sudah dinilai
  - essay belum sepenuhnya dinilai

Sumber seed terpusat di:
- `src/lib/server/db/seed-shared.mjs`

Entry Prisma seed:
- `prisma/seed.mjs`

Tujuannya supaya **jalur seed CLI** dan **jalur seed server** tidak drift.

---

## Akun Demo

> Data seed bisa berubah seiring pengembangan, tapi akun default berikut disiapkan oleh seed saat ini.

### Admin
- `admin / admin123`

### Operator
- `operator1 / operator123`

### Guru
- `guru_mtk / guru123`
- `guru_fisika / guru123`
- `guru_biologi / guru123`

### Peserta
- `alif.mahendra / peserta123`
- `nayla.putri / peserta123`
- `fajar.ramadhan / peserta123`
- `salma.azzahra / peserta123`
- `rizky.pratama / peserta123`
- `intan.permata / peserta123`
- `bagas.saputra / peserta123`
- `citra.lestari / peserta123`

---

## Menjalankan Project

## 1. Install dependency

```bash
npm install
```

## 2. Siapkan database

Pastikan `DATABASE_URL` mengarah ke SQLite. Project ini memakai Prisma config dari:

- `prisma.config.ts`

Jika perlu, jalankan migrasi:

```bash
npm run prisma:migrate
```

## 3. Seed database

```bash
npm run prisma:seed
```

## 4. Jalankan mode development

```bash
npm run dev
```

## 5. Build production

```bash
npm run build
```

---

## Script Penting

```bash
npm run dev
npm run build
npm run lint
npm run format
npm run prisma:validate
npm run prisma:migrate
npm run prisma:seed
```

Script pengecekan tambahan:

```bash
node scripts/check-admin-routes.mjs
```

---

## Struktur Folder Penting

```text
prisma/
  schema.prisma        # skema database
  seed.mjs             # entry Prisma seeder

src/
  components/          # komponen UI dan komponen CBT
  lib/
    cbt/               # types, repos, auth, exam logic
    server/            # server functions, db helpers, seed shared
  routes/              # file-based routes TanStack Start

scripts/
  check-admin-routes.mjs
```

File yang paling penting untuk memahami alur project:
- `src/lib/cbt/repos.ts` — facade repo/cache client
- `src/lib/server/repos/functions.ts` — bridge persistence server
- `src/lib/cbt/exam.ts` — pembentukan sesi dan penilaian ujian
- `src/lib/server/db/seed-shared.mjs` — sumber dataset dummy utama
- `prisma/schema.prisma` — model database

---

## Alur Data Singkat

1. UI meng-hydrate data awal dari server snapshot
2. Snapshot dimasukkan ke cache repo client
3. Halaman admin/peserta membaca data dari repo tersebut
4. Saat ada perubahan, cache diupdate dulu
5. Perubahan lalu dipersist ke SQLite melalui server function

Konsekuensinya:
- UX terasa cepat
- tetapi ada risiko cache client tidak sinkron bila request persist gagal atau ada perubahan dari tab/perangkat lain

---

## Verifikasi yang Disarankan

Setelah perubahan besar, jalankan:

```bash
npm run prisma:validate
npm run prisma:seed
npx tsc --noEmit
node scripts/check-admin-routes.mjs
npm run build
```

---

## Catatan Penting

- Data inti CBT sudah berbasis **SQLite**, bukan lagi murni local storage.
- Namun beberapa area masih merupakan sisa arsitektur browser-side / transisi.
- Fitur file/audio masih perlu perhatian khusus bila ingin full server-side.
- Build saat ini bisa menghasilkan warning chunk size dari Vite, tetapi itu **bukan blocker** untuk development lokal.

---

## Roadmap Teknis yang Masuk Akal

Beberapa langkah lanjutan yang relevan untuk project ini:

- migrasi dari cache repo global ke loader/query yang lebih server-driven
- perbaikan error handling pada optimistic mutation
- invalidation/refetch setelah mutasi
- penyempurnaan auth ke session/cookie server
- migrasi file/audio dari browser storage ke server storage
- penambahan pengujian otomatis untuk flow ujian dan evaluasi

---

## Cocok Untuk Siapa?

Project ini cocok untuk:
- sekolah / institusi yang ingin prototipe CBT modern
- developer yang ingin belajar alur ujian berbasis role
- tim produk yang butuh demo realistis untuk admin dan peserta
- eksperimen migrasi aplikasi frontend-heavy ke persistence server-side bertahap

---

## Lisensi

Belum ditentukan.

Jika project ini akan dipublikasikan lebih luas, tambahkan file `LICENSE` sesuai kebutuhan.
