# PRD — CBT-Kampus v2
**Product Requirements Document**
**Versi:** 2.0
**Terakhir diperbarui:** Juli 2026
**Status:** Draft untuk Review

---

## 1. Latar Belakang & Konteks

CBT-Kampus (Computer-Based Test Manager) adalah aplikasi ujian berbasis komputer untuk lembaga pendidikan Indonesia. Versi pertama (v1) telah berhasil diimplementasikan dengan fitur inti: bank soal terstruktur, manajemen ujian, penilaian otomatis & manual, analisis butir soal, dan pengelolaan peserta.

Versi 2 (v2) bertujuan untuk:
1. **Mempertahankan** seluruh kapabilitas v1 yang sudah berjalan baik.
2. **Memperbaiki** kelemahan arsitektur yang ditemukan selama evaluasi v1.
3. **Menambahkan** fitur yang sengaja ditangguhkan dari v1 (real-time monitoring, penegakan IP range, penguncian perangkat).
4. **Meningkatkan** skalabilitas agar dapat melayani sekolah dengan ribuan soal dan ratusan peserta bersamaan.

---

## 2. Pengguna & Peran

### 2.1 Segmen Pengguna

| Peran | Deskripsi | Kebutuhan Utama |
|---|---|---|
| **Admin** | Pengelola sistem penuh — biasanya IT atau kepala sekolah | Kontrol penuh atas seluruh data, pengaturan sistem, dan pengguna |
| **Operator / Guru** | Pembuat soal dan pengelola ujian — dibatasi oleh topik yang diizinkan | Manajemen soal, pembuatan ujian, evaluasi dan pelaporan |
| **Peserta / Siswa** | Peserta ujian | Mengerjakan ujian dengan antarmuka yang bersih, melihat hasil |

### 2.2 Prinsip Akses
- Admin: akses tak terbatas ke semua entitas dan pengaturan.
- Operator: dibatasi oleh `allowedTopikIds`. Jika kosong = akses semua topik.
- Peserta: hanya dapat melihat dan mengerjakan ujian yang ditugaskan ke group mereka.

---

## 3. Fitur yang Dipertahankan dari v1

Semua fitur berikut dipertahankan tanpa regresi:

### 3.1 Bank Soal
- Hierarki: **Modul → Topik → Soal → Jawaban**
- Tipe soal: **Pilihan Ganda (PG), Ganda Benar (Multi), Benar/Salah (BS), Essay**
- Level kesulitan: Mudah, Sedang, Sulit
- Dukungan audio per soal (play once)
- Import soal dari file Word (.docx) via mammoth
- Rich text editor dengan dukungan formula matematika (KaTeX)

### 3.2 Manajemen Ujian
- Konfigurasi: durasi, poin benar/salah/kosong, token akses, grup peserta, pengacakan soal dan jawaban
- Penjadwalan waktu mulai dan berakhir
- Mode fullscreen wajib dan deteksi pindah tab (batas konfigurabel)

### 3.3 Sesi Ujian Peserta
- Status sesi: belum mulai, berlangsung, selesai, kedaluwarsa
- Auto-save jawaban dengan debounce 500ms
- Flush saat tab ditutup (`beforeunload`)
- Timer countdown real-time

### 3.4 Penilaian
- Penilaian otomatis untuk PG, Multi, BS
- Penilaian manual essay oleh admin/operator
- Rekomputasi skor setelah penilaian manual

### 3.5 Analisis & Pelaporan
- Analisis butir soal: tingkat kesukaran (P), indeks diskriminasi (D), daya pengecoh
- Rekap hasil ujian per peserta dan per soal
- Leaderboard per ujian
- Export ke Excel

### 3.6 Manajemen Data
- Backup & restore snapshot JSON lengkap (termasuk file biner)
- Reset data seluruh sistem (admin only)
- Import dari file Word dan Excel
- Manajemen file media

---

## 4. Fitur Baru v2

### 4.1 Real-Time Monitoring Peserta (Prioritas Tinggi)

**Kebutuhan:**
Saat ujian berlangsung, admin/operator dapat melihat status peserta secara langsung — tanpa perlu refresh halaman manual.

**Perilaku yang diinginkan:**
- Halaman monitoring menampilkan daftar peserta dengan status: belum mulai, sedang mengerjakan, selesai.
- Status diperbarui otomatis setiap beberapa detik (polling SSE atau interval).
- Tampilkan jumlah soal yang sudah dijawab, sisa waktu, dan jumlah pelanggaran per peserta.
- Notifikasi visual ketika peserta baru mulai atau menyelesaikan ujian.

### 4.2 Penegakan IP Range (Prioritas Menengah)

**Konteks v1:** Fitur `ipRange` tersimpan di database tetapi tidak diberlakukan. Admin yang mengonfigurasinya percaya ada perlindungan padahal tidak ada.

**Kebutuhan v2:**
- Saat admin mengisi `ipRange` pada ujian, akses sesi peserta **benar-benar** dibatasi ke rentang IP tersebut.
- Validasi dilakukan di sisi server saat peserta mencoba membuka sesi ujian.
- Format: CIDR notation (contoh: `192.168.1.0/24`) atau rentang tunggal.
- Jika peserta di luar rentang, tampilkan pesan error yang jelas.
- UI admin yang telah ada diaktifkan (saat ini tersembunyi).

### 4.3 Penguncian Perangkat & Multi-Device (Prioritas Menengah)

**Konteks v1:** Pengaturan `mobileLock` dan `multiDevice` tersimpan tetapi tidak diberlakukan.

**Kebutuhan v2:**
- `mobileLock = true`: blokir akses dari perangkat mobile (user-agent detection + layar kecil).
- `multiDevice = false`: satu sesi aktif per peserta. Login di perangkat baru otomatis menghapus sesi lama.
- Tampilkan badge "Aktif" pada pengaturan yang sudah diberlakukan (bukan lagi "Belum diberlakukan").

### 4.4 Rate Limiting Login (Prioritas Tinggi)

**Kebutuhan:**
- Batasi percobaan login gagal: maksimal 5 kali dalam 10 menit per IP/username.
- Setelah limit tercapai, tampilkan pesan cooldown dengan sisa waktu.
- Tidak memerlukan CAPTCHA di v2 (cukup cooldown server-side).

### 4.5 Log Audit Admin (Prioritas Menengah)

**Kebutuhan:**
- Setiap aksi penting admin/operator dicatat: buat/ubah/hapus soal, buat ujian, nilai essay, reset data, import backup.
- Log menampilkan: siapa, aksi apa, kapan, entitas apa.
- Admin dapat melihat log audit di halaman khusus dengan filter tanggal dan peran.
- Log tidak dapat dihapus melalui UI (read-only untuk semua peran termasuk admin).

### 4.6 Hidrasi Data Parsial / Lazy Loading (Prioritas Tinggi)

**Konteks v1:** Seluruh database dimuat ke memori klien setiap kali login. Ini tidak skalabel.

**Kebutuhan v2:**
- Data berat (soal, sesi) dimuat secara lazy: hanya dimuat ketika halaman yang relevan dibuka.
- Data ringan (config, user sendiri, daftar ujian) tetap dimuat saat boot.
- Pagination untuk daftar soal, sesi, dan pengguna di panel admin.
- Target: waktu hydration awal < 500ms bahkan dengan 10.000 soal di database.

---

## 5. Peningkatan Non-Fungsional

### 5.1 Keamanan
- Ganti perbandingan string password dengan perbandingan constant-time (`crypto.timingSafeEqual`).
- Rate limiting pada endpoint login.
- Validasi IP range yang sebenarnya diberlakukan di server.
- Session revocation instan ketika user dinonaktifkan (sudah ada, pastikan tidak ada celah cache).

### 5.2 Performa
- Hidrasi parsial (lihat 4.6).
- Lazy loading koleksi besar.
- Target: First Contentful Paint (FCP) < 1.5 detik di jaringan sekolah tipikal (10 Mbps).

### 5.3 Keandalan
- Penanganan error server yang lebih granular (saat ini semua 500 dikembalikan sebagai HTML error page generik).
- Rollback optimis yang lebih baik — kembalikan state sebelum mutasi jika server menolak, bukan hanya re-hydrate penuh.
- Tambah test integrasi untuk alur kritis: login, mulai ujian, submit, penilaian.

### 5.4 Maintainability
- Pecah `functions.ts` (~1.400 baris) menjadi modul per domain.
- Normalisasi field JSON-as-string ke tabel join yang proper (migrasi database).

---

## 6. Fitur yang TIDAK Termasuk dalam v2

- Dukungan multi-database (PostgreSQL, MySQL) — direncanakan untuk v3.
- Autentikasi OAuth / SSO — direncanakan untuk v3.
- Aplikasi mobile native — bukan prioritas.
- Streaming video soal — bukan prioritas.

---

## 7. Kriteria Keberhasilan

| Metrik | Target v2 |
|---|---|
| Waktu hydration awal | < 500ms (10.000 soal) |
| Waktu update monitoring | < 5 detik dari kejadian nyata |
| Uptime | ≥ 99,5% (self-hosted, single node) |
| Cakupan tes alur kritis | ≥ 80% (unit + integrasi) |
| Zero regresi fitur v1 | 100% fitur v1 tetap berfungsi |
| Tidak ada celah RBAC terverifikasi | Semua pengujian adversarial lulus |

---

## 8. Asumsi & Kendala

- Deployment tetap **self-hosted single-node** (tidak ada load balancer atau cluster).
- Database tetap **SQLite** untuk v2; multi-DB direncanakan untuk v3.
- UI tetap berbahasa Indonesia.
- Tidak ada perubahan breaking pada format file backup JSON v1 (kompatibel mundur).
- Tim pengembang: 1–2 orang.
