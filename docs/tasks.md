# Daftar Tugas — CBT-MAN v2
**Task List & Implementation Checklist**
**Versi:** 2.0
**Terakhir diperbarui:** Juli 2026

---

> **Keterangan Status:**
> - `[ ]` Belum dikerjakan
> - `[/]` Sedang dikerjakan
> - `[x]` Selesai
>
> **Keterangan Prioritas:**
> - 🔴 Tinggi — kerjakan lebih dulu
> - 🟡 Menengah — kerjakan setelah yang tinggi
> - 🟢 Rendah — V2 polish / nice-to-have

---

## Baseline yang diterima (v0.1.1)

Checklist Juli 2026 di bawah **bukan** acceptance baseline. Beberapa kotak `[ ]` sudah masuk `main` sampai tag `v0.1.1` (`ec042ba`): auth server, klaim token, throttle login 5/10 menit, scope file operator, batch monitor, blokir clipboard, audit/restore, SQLite sekarang / PostgreSQL kemudian.

Yang **bukan** baseline: snapshot lazy penuh (F-06, sisa admin), normalisasi JSON (F-18), Playwright (F-10), alarm/force-logout ujian (F-22/F-24/F-25), hop PostgreSQL, pengukuran WAL, kuota unggah.

Ini bukan klaim siap produksi atau v1.0.0. Rincian: bagian baseline di `docs/prd.md`.

---

## Fase 0 — Persiapan

- [x] 🔴 Buat branch `v2-dev` dari `main`
- [x] 🔴 Pastikan seluruh test v1 lulus di branch baru (`npm run test:unit`, `npm run typecheck`, `npm run lint`)
- [x] 🔴 Dokumentasikan snapshot state v1 (versi semua dependensi, jumlah baris kode, daftar route)
- [x] 🔴 Siapkan lingkungan staging dengan database SQLite tersedia untuk pengujian integrasi

---

## Fase 1 — Refaktor: Pecah `functions.ts` (Prioritas Tinggi)

> **Konteks:** `src/lib/server/repos/functions.ts` saat ini ~1.400 baris. Semua logika auth, user, modul, soal, ujian, sesi, backup ada di satu file. Ini harus dipecah tanpa mengubah perilaku.

- [x] 🔴 Buat folder struktur baru:
  ```
  src/lib/server/auth/functions.ts
  src/lib/server/users/functions.ts
  src/lib/server/modul/functions.ts
  src/lib/server/ujian/functions.ts
  src/lib/server/sesi/functions.ts
  src/lib/server/snapshot/functions.ts
  src/lib/server/audit/functions.ts
  src/lib/server/backup/functions.ts
  ```
- [x] 🔴 Pindahkan `loginServer`, `logoutServer`, `validateSessionServer` ke `auth/functions.ts`
- [x] 🔴 Pindahkan CRUD user & group ke `users/functions.ts`
- [x] 🔴 Pindahkan CRUD modul, topik, soal ke `modul/functions.ts`
- [x] 🔴 Pindahkan CRUD ujian & token ke `ujian/functions.ts`
- [x] 🔴 Pindahkan create/update/grade sesi ke `sesi/functions.ts`
- [x] 🔴 Pindahkan `getCbtSnapshot`, `getPublicBootConfigServer` ke `snapshot/functions.ts`
- [x] 🔴 Pindahkan `importBackupServer`, `resetAllDataServer` ke `backup/functions.ts`
- [x] 🔴 Perbarui semua import di `src/lib/cbt/repos.ts` dan `src/lib/cbt/auth-store.ts`
- [x] 🔴 Perbarui semua import di seluruh route (`src/routes/_authenticated/`)
- [x] 🔴 Hapus file `src/lib/server/repos/functions.ts` yang lama setelah semua import diperbarui
- [x] 🔴 Jalankan `npm run typecheck` dan `npm run test:unit` — pastikan tidak ada regresi

---

## Fase 2 — Keamanan: Perbaikan Kritis (Prioritas Tinggi)

### 2.1 Constant-Time Password Comparison

- [ ] 🔴 Buka `src/lib/cbt/hash.ts`, fungsi `verifyPassword`
- [ ] 🔴 Ganti `b64(hash) === hashB64` dengan `timingSafeEqual` dari `node:crypto`
  - Import: `import { timingSafeEqual } from "node:crypto"`
  - Konversi kedua string ke `Buffer` sebelum dibandingkan
  - Tangani kasus panjang berbeda (langsung return `false` tanpa memanggil `timingSafeEqual`)
- [ ] 🔴 Tambah unit test untuk `verifyPassword` dengan hash valid, hash tidak valid, dan hash dengan panjang berbeda

### 2.2 Rate Limiting Login

- [ ] 🔴 Buat `src/lib/server/db/rate-limit.ts`
  - Implementasi `RateLimiter` class dengan in-memory `Map`
  - Method: `check(key): { allowed, retryAfterMs }`, `record(key)`, `reset(key)`
  - Sliding window: 5 percobaan / 10 menit
  - Export singleton `rateLimiter`
- [ ] 🔴 Integrasikan `rateLimiter` di `auth/functions.ts`:
  - Sebelum validasi password: cek rate limit untuk `ip:{ip}` dan `user:{username}`
  - Jika tidak diizinkan: kembalikan error dengan `retryAfterMs`
  - Setelah login gagal: catat ke rate limiter
  - Setelah login sukses: reset counter
- [ ] 🔴 Perbarui respons login di client (`auth-store.ts`) untuk menampilkan pesan cooldown dengan sisa waktu
- [ ] 🔴 Tambah unit test untuk `RateLimiter`:
  - 4 percobaan gagal → masih diizinkan
  - 5 percobaan gagal → diblokir
  - Setelah jendela habis → diizinkan kembali
  - Login sukses → counter reset

---

## Fase 3 — Database: Normalisasi Skema (Prioritas Menengah)

> **Perhatian:** Fase ini memerlukan migrasi data. Lakukan di lingkungan staging terlebih dahulu.

### 3.1 Tambah Tabel Join

- [ ] 🟡 Tambah model `UserTopikAccess` ke `prisma/schema.prisma`
- [ ] 🟡 Tambah model `UjianGroup` ke `prisma/schema.prisma`
- [ ] 🟡 Tambah model `TopicSet` (tabel proper) ke `prisma/schema.prisma`
- [ ] 🟡 Tambah model `SoalSesi` ke `prisma/schema.prisma`
- [ ] 🟡 Tambah model `JawabanSesi` ke `prisma/schema.prisma`
- [ ] 🟡 Tambah model `AuditLog` ke `prisma/schema.prisma`
- [ ] 🟡 Jalankan `npm run prisma:migrate` untuk membuat migrasi additive

### 3.2 Migrasi Data

- [ ] 🟡 Buat script migrasi data `scripts/migrate-v1-to-v2.mjs`:
  - Baca `User.allowedTopikIds` (JSON) → isi `UserTopikAccess`
  - Baca `Ujian.groupIds` (JSON) → isi `UjianGroup`
  - Baca `Ujian.topicSets` (JSON) → isi `TopicSet` (tabel baru)
  - Baca `SesiUjian.soalIds` (JSON) → isi `SoalSesi`
  - Baca `SesiUjian.jawaban` (JSON) → isi `JawabanSesi`
- [ ] 🟡 Verifikasi integritas data setelah migrasi (hitung jumlah baris, cek relasi)
- [ ] 🟡 Jalankan migrasi di staging → verifikasi → lalu di produksi

### 3.3 Update Kode

- [ ] 🟡 Perbarui `modul/functions.ts` untuk baca/tulis `UserTopikAccess` alih-alih JSON string
- [ ] 🟡 Perbarui `ujian/functions.ts` untuk baca/tulis `UjianGroup` dan `TopicSet`
- [ ] 🟡 Perbarui `sesi/functions.ts` untuk baca/tulis `SoalSesi` dan `JawabanSesi`
- [ ] 🟡 Perbarui mapping di `snapshot/functions.ts` agar struktur data yang dikembalikan tetap kompatibel dengan `src/lib/cbt/types.ts`
- [ ] 🟡 Hapus kolom JSON lama dari skema dengan migrasi terpisah setelah verifikasi penuh

### 3.4 Backup Adapter v1

- [ ] 🟡 Tambah adapter di `backup/functions.ts` yang mendeteksi format backup v1 (JSON-in-string) dan mengonversinya ke format v2 saat import

---

## Fase 4 — Hidrasi Parsial / Lazy Loading (Prioritas Tinggi)

- [ ] 🔴 Buat `snapshot/functions.ts` dengan dua fungsi:
  - `getBootSnapshot()`: kembalikan hanya config, user sendiri, dan daftar ujian (tanpa soal/sesi)
  - `getPageSnapshot(page, params)`: kembalikan data spesifik per halaman dengan paginasi
- [ ] 🔴 Perbarui `src/lib/cbt/repos.ts`:
  - Ganti `hydrateRepos()` dengan `hydrateBootSnapshot()`
  - Tambah `hydratePage(page, params)` untuk lazy load per halaman
  - Tambah `invalidate(entity)` untuk invalidasi parsial per entitas
- [ ] 🔴 Perbarui loader di setiap route untuk memanggil `hydratePage` yang sesuai:
  - `admin.modul.tsx` → load modul + topik
  - `admin.topik.$id.soal.tsx` → load soal (paginasi)
  - `admin.peserta.tsx` → load users (paginasi)
  - `admin.hasil.tsx` → load sesi (paginasi, filter per ujian)
  - `peserta.ujian.$id.kerjakan.tsx` → load sesi peserta + soal terkait
- [ ] 🔴 Tambah komponen pagination yang reusable di `src/components/ui/`
- [ ] 🔴 Uji performa: waktu hydration awal < 500ms di dataset 10.000 soal

---

## Fase 5 — Monitoring Real-Time (SSE)

- [ ] 🟡 Buat route API SSE: `src/routes/api.monitoring.$ujianId.ts`
  - Validasi session (hanya admin/operator)
  - Kembalikan `Response` dengan `ReadableStream` dan header `Content-Type: text/event-stream`
- [ ] 🟡 Buat helper broadcast di `src/lib/server/sesi/broadcast.ts`:
  - `Map<ujianId, Set<ReadableStreamController>>` sebagai registry subscriber
  - `subscribe(ujianId, controller)`, `unsubscribe(ujianId, controller)`
  - `broadcastSesiUpdate(ujianId, payload)` — dipanggil setiap kali sesi diperbarui
- [ ] 🟡 Integrasikan `broadcastSesiUpdate` ke dalam `sesi/functions.ts` setiap kali sesi di-upsert
- [ ] 🟡 Implementasi heartbeat setiap 15 detik per koneksi SSE
- [ ] 🟡 Perbarui `admin.peserta.online.tsx`:
  - Buat `EventSource` saat komponen mount, tutup saat unmount
  - Update state lokal saat menerima event `sesi_update`
  - Tampilkan indikator koneksi (tersambung / terputus)
  - Implementasi reconnect dengan backoff eksponensial (1s → 2s → 4s → ... maks 30s)
- [ ] 🟡 Tambah test manual: buka monitoring, mulai ujian dari browser lain, pastikan status berubah < 5 detik

---

## Fase 6 — Fitur yang Ditangguhkan dari v1

### 6.1 Penegakan IP Range

- [ ] 🟡 Buat `src/lib/server/sesi/ip-check.ts`:
  - Fungsi `isIpAllowed(clientIp: string, ipRange: string): boolean`
  - Dukung CIDR (`192.168.1.0/24`) dan IP tunggal
  - Implementasi CIDR tanpa dependensi eksternal (bitwise comparison)
- [ ] 🟡 Integrasikan validasi IP di `sesi/functions.ts` saat peserta buat atau resume sesi
  - Ambil IP klien dari header request (`X-Forwarded-For`, `X-Real-IP`, fallback ke koneksi langsung)
  - Kembalikan error `IP_NOT_ALLOWED` jika IP di luar range
- [ ] 🟡 Aktifkan UI input IP range di form edit ujian (`admin.ujian.$id.tsx`) — saat ini tersembunyi
- [ ] 🟡 Tambah unit test untuk semua kasus CIDR matching (edge cases: /0, /32, IP parsial)

### 6.2 Penguncian Perangkat (`mobileLock`)

- [ ] 🟡 Implementasi deteksi mobile di middleware route peserta:
  - Cek user-agent untuk indikasi mobile
  - Cek lebar layar via CSS media query yang dikembalikan dari SSR
  - Jika mobile dan `config.mobileLock = true`: redirect ke halaman error yang informatif
- [ ] 🟡 Aktifkan toggle `mobileLock` di `admin.pengaturan.tsx` — hapus badge "Belum diberlakukan"

### 6.3 Satu Sesi Per Peserta (`multiDevice = false`)

- [ ] 🟡 Di `auth/functions.ts`, saat login sukses dan `config.multiDevice = false`:
  - Hapus semua sesi login lama milik user tersebut (panggil `deleteSessionsForUser` yang sudah ada)
  - Buat sesi baru
- [ ] 🟡 Aktifkan toggle `multiDevice` di `admin.pengaturan.tsx` — hapus badge "Belum diberlakukan"

---

## Fase 7 — Log Audit

- [ ] 🟡 Buat `src/lib/server/db/audit.ts`:
  - Fungsi `writeAuditLog(params)` yang menulis ke tabel `AuditLog`
  - Tangani error penulisan log dengan silent catch (log gagal tidak boleh crash request utama)
- [ ] 🟡 Tambah panggilan `writeAuditLog` di setiap server function yang relevan:
  - `auth/functions.ts`: login sukses, logout
  - `users/functions.ts`: buat, ubah, hapus user/group
  - `modul/functions.ts`: buat, ubah, hapus soal/topik/modul
  - `ujian/functions.ts`: buat, ubah, hapus ujian
  - `sesi/functions.ts`: grade essay
  - `backup/functions.ts`: import backup, reset data
- [ ] 🟡 Buat `audit/functions.ts` dengan `getAuditLogServer(params)`:
  - Filter: `fromDate`, `toDate`, `actorRole`, `action`
  - Paginasi: 50 baris per halaman
- [ ] 🟡 Buat halaman baru `src/routes/_authenticated/admin.audit.tsx`:
  - Tampilkan tabel log dengan kolom: Waktu, Aktor, Peran, Aksi, Entitas
  - Filter tanggal dan jenis aksi
  - Paginasi
  - Hanya dapat diakses oleh admin
- [ ] 🟡 Tambah link "Log Audit" di navigasi admin

---

## Fase 8 — Optimistic Rollback yang Lebih Baik

- [ ] 🟢 Perbarui `createRepo<T>` di `src/lib/cbt/repos.ts`:
  - Simpan snapshot pre-mutasi sebelum optimistic update
  - Kirimkan snapshot ke dalam closure queue
  - Jika server menolak: rollback ke snapshot, tampilkan toast
  - Hapus fallback `full re-hydrate` dari `notifyMutationFailure` untuk kasus mutasi biasa (pertahankan hanya untuk konflik kritis)
- [ ] 🟢 Uji rollback: simulasikan gagal jaringan saat upsert soal → verifikasi UI kembali ke state sebelumnya

---

## Fase 9 — Pengujian

### 9.1 Perluasan Unit Test

- [ ] 🔴 Unit test `rate-limit.ts` (lihat Fase 2.2)
- [ ] 🔴 Unit test `hash.ts` — termasuk `timingSafeEqual`
- [ ] 🟡 Unit test `ip-check.ts` — semua kasus CIDR
- [x] 🟡 Unit test `scoring.ts` — `gradeAnswers` / `recomputeSkor` dengan soal essay, multi-benar, dan soal tanpa jawaban
- [ ] 🟡 Unit test `analisis.ts` — dengan distribusi skor ekstrem (semua benar / semua salah)

### 9.2 Integration Test (baru)

- [ ] 🟡 Setup Playwright atau framework integrasi yang dipilih
- [ ] 🟡 Tulis test skenario kritis:
  - `tests/integration/login-rate-limit.test.ts`
  - `tests/integration/exam-flow.test.ts` (login → mulai → submit → lihat hasil)
  - `tests/integration/rbac-operator.test.ts` (operator tidak bisa akses soal di luar scope)
  - `tests/integration/ip-restriction.test.ts`
  - `tests/integration/backup-restore.test.ts`
  - `tests/integration/session-expire.test.ts`
- [ ] 🟡 Tambah script `npm run test:integration` di `package.json`
- [ ] 🟡 Pastikan semua test integrasi lulus sebelum merge ke `main`

---

## Fase 10 — Dokumentasi & Polish

- [ ] 🟢 Perbarui `README.md`:
  - Tambah bagian "Fitur v2"
  - Perbarui panduan setup (tambah langkah migrasi data v1→v2)
  - Perbarui tabel akun demo jika ada perubahan
- [ ] 🟢 Buat `docs/migration-v1-to-v2.md`:
  - Panduan step-by-step migrasi database dari v1 ke v2
  - Catatan kompatibilitas mundur backup
- [ ] 🟢 Buat `docs/deferred-work.md` (jika belum ada):
  - Daftarkan fitur yang sengaja ditunda ke v3 (multi-DB, OAuth, dll)
- [ ] 🟢 Perbarui `CONTRIBUTING.md` dengan konvensi baru (struktur folder server, aturan import)

---

## Ringkasan Prioritas

### Kerjakan Lebih Dulu (Fase 1, 2, 4)
1. Pecah `functions.ts` → tidak ada regresi, developer experience jauh lebih baik
2. Perbaiki `verifyPassword` → constant-time comparison (5 menit kode, dampak keamanan nyata)
3. Implementasi rate limiting login → proteksi brute-force
4. Hidrasi parsial → skalabilitas

### Kerjakan Setelah (Fase 3, 5, 6, 7)
5. Normalisasi skema DB (butuh perencanaan migrasi hati-hati)
6. SSE monitoring real-time
7. Penegakan IP range + mobileLock + multiDevice
8. Log audit

### Polish (Fase 8, 9, 10)
9. Optimistic rollback yang lebih baik
10. Integration tests lengkap
11. Dokumentasi
