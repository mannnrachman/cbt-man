# Spesifikasi Teknis — CBT-Kampus v2
**Technical Specification**
**Versi:** 2.0
**Terakhir diperbarui:** Juli 2026
**Status:** Draft untuk Review

---

## 1. Stack Teknologi

Tidak ada perubahan mayor pada stack. Seluruh dependensi dipertahankan kecuali yang disebutkan di bawah.

### 1.1 Stack Utama (dipertahankan dari v1)

| Lapisan | Teknologi | Versi |
|---|---|---|
| Meta-framework | TanStack Start (React SSR + Nitro) | ^1.x |
| Routing | TanStack Router (file-based) | ^1.x |
| UI | React 19 | ^19 |
| State management | Zustand | ^5 |
| Komponen UI | Radix UI + shadcn/ui pattern | latest |
| Styling | Tailwind CSS 4 | ^4 |
| ORM | Prisma | ^6 |
| Database | SQLite | — |
| Build tool | Vite | ^7 |
| Validasi | Zod | ^3 |
| Bahasa | TypeScript | ^5.8 |

### 1.2 Dependensi Baru v2

| Paket | Kegunaan | Catatan |
|---|---|---|
| `ip-range-check` atau implementasi native | Validasi CIDR/IP range | Pertimbangkan implementasi sendiri untuk meminimalkan dependensi |
| Tidak ada paket baru untuk SSE | Server-Sent Events menggunakan Web Streams API native | Tersedia di Nitro/Node 18+ |
| `lru-cache` (opsional) | Rate limiter in-memory berbasis LRU | Alternatif: implementasi sendiri dengan Map + TTL |

---

## 2. Arsitektur Sistem

### 2.1 Gambaran Umum (v2)

```
Browser                                     Server (Nitro/Node)
──────────────────────────────────────────  ────────────────────────────────────
React 19 + TanStack Router (file-based)     TanStack Start server functions
  │                                           │
  ├─ Zustand auth-store                       ├─ lib/server/auth/functions.ts
  │   └─ login / logout / refresh             ├─ lib/server/users/functions.ts
  │                                           ├─ lib/server/modul/functions.ts
  ├─ Boot hydration (ringan)                  ├─ lib/server/ujian/functions.ts
  │   └─ config, user sendiri, daftar ujian   ├─ lib/server/sesi/functions.ts
  │                                           ├─ lib/server/files/functions.ts
  ├─ Lazy hydration (per halaman)             ├─ lib/server/audit/functions.ts
  │   └─ soal, sesi, peserta (dengan          └─ lib/server/db/
  │      pagination)                              ├─ prisma.ts
  │                                               ├─ session.ts
  ├─ repos.ts (cache in-memory parsial)           ├─ rate-limit.ts
  │   └─ Optimistic write + queue                 └─ audit.ts
  │
  ├─ SSE client (monitoring)
  │   └─ EventSource → /api/monitoring/$ujianId
  │
  └─ UI Routes (34+ routes)
```

### 2.2 Perbedaan Arsitektur v1 → v2

| Aspek | v1 | v2 |
|---|---|---|
| Hydration | Snapshot penuh seluruh DB | Boot snapshot ringan + lazy per halaman |
| Server functions | 1 file `functions.ts` (~1.400 baris) | Dipecah per domain ke folder `lib/server/{domain}/` |
| Real-time | Tidak ada | SSE untuk monitoring ujian |
| Skema DB | JSON string untuk relasi | Tabel join proper untuk `allowedTopik`, `groupIds`, `topicSets` |
| Rate limiting | Tidak ada | In-memory rate limiter pada endpoint login |
| Audit log | Tidak ada | Tabel `AuditLog` + server function + halaman admin |
| IP enforcement | Tersimpan, tidak diberlakukan | Diberlakukan di server saat sesi dibuat |
| Password compare | `===` string biasa | `crypto.timingSafeEqual` |

---

## 3. Desain Ulang Modul Server Functions

### 3.1 Struktur Folder Baru

```
src/lib/server/
├── db/
│   ├── prisma.ts          # Prisma client singleton (tidak berubah)
│   ├── session.ts         # Cookie session management (tidak berubah)
│   ├── id.ts              # ID generator (tidak berubah)
│   ├── json.ts            # BigInt ↔ Number helpers (tidak berubah)
│   ├── rate-limit.ts      # [BARU] In-memory rate limiter
│   └── audit.ts           # [BARU] Helper tulis AuditLog
├── auth/
│   └── functions.ts       # loginServer, logoutServer, validateSessionServer
├── users/
│   └── functions.ts       # CRUD users, groups, password change
├── modul/
│   └── functions.ts       # CRUD modul, topik, soal
├── ujian/
│   └── functions.ts       # CRUD ujian, token, konfigurasi
├── sesi/
│   └── functions.ts       # Create/update sesi, grading, submit
├── snapshot/
│   └── functions.ts       # getCbtSnapshot (boot), getPageSnapshot (lazy)
├── files/
│   └── functions.ts       # Upload, download, list files (tidak berubah)
├── audit/
│   └── functions.ts       # [BARU] getAuditLog server function
└── backup/
    └── functions.ts       # importBackup, resetAllData, exportBackup
```

### 3.2 Kontrak per Modul

Setiap `functions.ts` per domain hanya boleh:
- Mengimpor dari `@/lib/server/db/*` dan `@/lib/cbt/types`.
- Mengekspor fungsi-fungsi yang dibuat dengan `createServerFn`.
- Tidak boleh mengimpor dari domain server lain (hindari coupling melingkar).

---

## 4. Perubahan Skema Database

### 4.1 Normalisasi Field JSON-as-String

**Sebelum (v1):**
```
User {
  allowedTopikIds  String  @default("[]")   // JSON array
}

Ujian {
  groupIds    String  @default("[]")        // JSON array
  topicSets   String  @default("[]")        // JSON array of objects
}

SesiUjian {
  soalIds      String  @default("[]")       // JSON array
  jawabanOrder String  @default("{}")       // JSON object
  jawaban      String  @default("[]")       // JSON array of objects
}
```

**Sesudah (v2):**
```
model UserTopikAccess {
  userId   String
  topikId  String
  user     User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  topik    Topik  @relation(fields: [topikId], references: [id], onDelete: Cascade)
  @@id([userId, topikId])
}

model UjianGroup {
  ujianId  String
  groupId  String
  ujian    Ujian  @relation(fields: [ujianId], references: [id], onDelete: Cascade)
  group    Group  @relation(fields: [groupId], references: [id], onDelete: Cascade)
  @@id([ujianId, groupId])
}

model TopicSet {
  id             String  @id
  ujianId        String
  topikId        String
  tipe           TipeSoal?
  kesulitan      Kesulitan?
  jumlah         Int
  jumlahOpsi     Int     @default(4)
  acakSoal       Boolean @default(true)
  acakJawaban    Boolean @default(true)
  urutan         Int     @default(0)
  ujian          Ujian   @relation(...)
  topik          Topik   @relation(...)
}

model SoalSesi {
  sesiId   String
  soalId   String
  urutan   Int
  sesi     SesiUjian @relation(...)
  soal     Soal      @relation(...)
  @@id([sesiId, soalId])
}

model JawabanSesi {
  id              String  @id
  sesiId          String
  soalId          String
  jawabanIds      String  @default("[]")  // tetap JSON: array ID jawaban terpilih
  jawabanEssay    String  @default("")
  jawabanOrder    String  @default("[]")  // urutan pilihan yang ditampilkan ke peserta
  ragu            Boolean @default(false)
  skor            Float?
  catatanGrader   String?
  sesi            SesiUjian @relation(...)
}
```

> **Catatan:** `jawabanIds` dan `jawabanOrder` di dalam `JawabanSesi` tetap JSON array karena keduanya adalah data urutan/pilihan sederhana yang tidak perlu di-query secara relasional.

### 4.2 Tabel Baru

```
model AuditLog {
  id         String   @id
  actorId    String                          // user yang melakukan aksi
  actorRole  Role
  action     String                          // "create", "update", "delete", "grade", "import", "reset"
  entity     String                          // "soal", "ujian", "sesi", "user", dll
  entityId   String?                         // ID entitas yang terpengaruh
  detail     String   @default("{}")         // JSON snapshot perubahan (before/after)
  createdAt  BigInt
  actor      User     @relation(fields: [actorId], references: [id])

  @@index([actorId])
  @@index([entity, entityId])
  @@index([createdAt])
}

model RateLimitEntry {
  key        String   @id                    // "ip:{ip}" atau "user:{username}"
  attempts   Int      @default(0)
  resetAt    BigInt                          // epoch ms kapan counter direset
}
```

> **Catatan:** `RateLimitEntry` dapat juga diimplementasikan sebagai in-memory Map di `rate-limit.ts` tanpa tabel DB — memadai untuk single-node. Tabel DB diperlukan hanya jika restart server harus mempertahankan state rate limit.

### 4.3 Perubahan pada Tabel Existng

```diff
model AppConfig {
+  ipRangeEnabled  Boolean @default(false)    // apakah penegakan IP range aktif secara global
}

model Session {
  // Tidak ada perubahan struktural
  // Tambah index composite untuk revocation cepat
+ @@index([expiresAt])
}
```

### 4.4 Strategi Migrasi

1. Buat migrasi Prisma yang menambahkan tabel join baru dan tabel `AuditLog`.
2. Buat script migrasi data satu kali yang membaca kolom JSON lama dan mengisi tabel join baru.
3. Setelah verifikasi data di lingkungan staging, hapus kolom JSON lama dengan migrasi terpisah.
4. Pertahankan kompatibilitas mundur format backup JSON v1 dengan adapter di `backup/functions.ts`.

---

## 5. Hidrasi Parsial (Boot + Lazy)

### 5.1 Boot Snapshot (selalu dimuat saat login)

```
getBootSnapshot() → {
  user: User (diri sendiri),
  config: AppConfig,
  ujian: Ujian[] (semua, kecuali topicSets — dimuat lazy),
  groups: Group[],
}
```

Ukuran payload target: < 50 KB untuk institusi ukuran rata-rata.

### 5.2 Lazy Snapshot per Halaman

| Halaman | Data yang Dimuat |
|---|---|
| `/admin/modul` | `Modul[]`, `Topik[]` (tanpa soal) |
| `/admin/modul/$id/topik` | `Soal[]` untuk topik tersebut (paginasi 50/halaman) |
| `/admin/ujian/$id` | `TopicSet[]` untuk ujian tersebut, `TokenUjian[]` |
| `/admin/peserta` | `User[]` (paginasi 100/halaman) |
| `/admin/hasil` | `SesiUjian[]` (paginasi, filter per ujian) |
| `/peserta/ujian/$id/kerjakan` | `SesiUjian` peserta sendiri + `Soal[]` terkait |

### 5.3 Perubahan pada `repos.ts`

- `hydrateRepos()` diganti dengan `hydrateBootSnapshot()` — hanya memuat data ringan.
- Tambah fungsi `hydratePage(page: PageKey)` yang dimuat dari loader route masing-masing.
- Cache tetap in-memory per entitas; `invalidate(entity)` hanya menghapus entitas tersebut.

---

## 6. Server-Sent Events — Monitoring Real-Time

### 6.1 Endpoint

```
GET /api/monitoring/:ujianId
Authorization: cookie session (admin/operator)
Content-Type: text/event-stream
```

### 6.2 Kontrak Event

```
event: sesi_update
data: { pesertaId, status, jumlahJawaban, pelanggaran, endsAt }

event: heartbeat
data: { ts }
```

### 6.3 Implementasi Server

- Gunakan `ReadableStream` (Web Streams) yang didukung Nitro secara native.
- Setiap perubahan pada `SesiUjian` (via `mutateEntity` di domain sesi) memanggil helper `broadcastSesiUpdate(ujianId, data)`.
- Simpan daftar subscriber aktif dalam `Map<ujianId, Set<WritableStreamWriter>>` di memori server.
- Heartbeat setiap 15 detik untuk mendeteksi koneksi mati.
- Batas: satu admin bisa subscribe ke satu ujian sekaligus; tidak ada batas jumlah admin yang subscribe ke ujian yang sama.

### 6.4 Implementasi Client

- Gunakan `EventSource` standar browser.
- Halaman monitoring (`admin.peserta.online.tsx`) subscribe ke SSE saat mount dan unsubscribe saat unmount.
- Jika koneksi putus, reconnect otomatis dengan backoff eksponensial (maks 30 detik).

---

## 7. Rate Limiting Login

### 7.1 Algoritma

- Sliding window counter per kunci (`ip:{ip}` dan `user:{username}`).
- Jendela: 10 menit, batas: 5 percobaan gagal.
- Setelah batas tercapai: tolak semua request login dari kunci tersebut sampai jendela berakhir.
- Counter direset otomatis setelah 10 menit.

### 7.2 Implementasi

```
src/lib/server/db/rate-limit.ts

class RateLimiter {
  private store: Map<string, { count: number; resetAt: number }>

  check(key: string): { allowed: boolean; retryAfterMs: number }
  record(key: string): void
  reset(key: string): void    // dipanggil saat login sukses
}
```

- Implementasi in-memory (Map) untuk v2 single-node.
- Jika server restart, counter hilang — acceptable untuk v2.
- Dua kunci per percobaan: IP dan username, keduanya harus lolos.

### 7.3 Respons Error

```json
{
  "ok": false,
  "error": "Terlalu banyak percobaan login. Coba lagi dalam 8 menit 23 detik.",
  "retryAfterMs": 503000
}
```

---

## 8. Penegakan IP Range

### 8.1 Kapan Divalidasi

Validasi dilakukan di server saat:
1. Peserta mencoba membuat atau melanjutkan `SesiUjian`.
2. `ujian.ipRange` tidak kosong.

### 8.2 Implementasi

```typescript
// src/lib/server/sesi/ip-check.ts
function isIpAllowed(clientIp: string, ipRange: string): boolean {
  // Dukung format: "192.168.1.0/24" (CIDR) dan "192.168.1.5" (IP tunggal)
  // Implementasi CIDR matching tanpa dependensi eksternal
}
```

Ambil IP klien dari header `X-Forwarded-For` (jika di balik proxy) atau `request.headers.get("x-real-ip")`, dengan fallback ke IP koneksi langsung.

### 8.3 Respons Error

```json
{
  "ok": false,
  "error": "Akses ditolak. Ujian ini hanya dapat diakses dari jaringan yang diizinkan.",
  "code": "IP_NOT_ALLOWED"
}
```

---

## 9. Perbandingan Password Constant-Time

### 9.1 Perubahan

**Sebelum (v1):**
```typescript
return b64(hash) === hashB64;  // rentan timing attack
```

**Sesudah (v2):**
```typescript
import { timingSafeEqual } from "node:crypto";
const a = Buffer.from(b64(hash));
const b = Buffer.from(hashB64);
if (a.length !== b.length) return false;
return timingSafeEqual(a, b);
```

### 9.2 Lokasi Perubahan

File: `src/lib/cbt/hash.ts`, fungsi `verifyPassword`.

---

## 10. Log Audit

### 10.1 Helper Penulisan Log

```typescript
// src/lib/server/db/audit.ts
async function writeAuditLog(params: {
  actorId: string;
  actorRole: Role;
  action: "create" | "update" | "delete" | "grade" | "import" | "reset" | "login" | "logout";
  entity: string;
  entityId?: string;
  detail?: Record<string, unknown>;
}): Promise<void>
```

### 10.2 Aksi yang Dicatat

| Aksi | Entitas | Dicatat oleh |
|---|---|---|
| Login sukses | `user` | `auth/functions.ts` |
| Logout | `user` | `auth/functions.ts` |
| Buat/ubah/hapus user | `user` | `users/functions.ts` |
| Buat/ubah/hapus soal | `soal` | `modul/functions.ts` |
| Buat/ubah/hapus ujian | `ujian` | `ujian/functions.ts` |
| Grade essay | `sesi` | `sesi/functions.ts` |
| Import backup | `system` | `backup/functions.ts` |
| Reset data | `system` | `backup/functions.ts` |

### 10.3 Tampilan Audit Log

- Halaman: `/admin/audit` (rute baru, hanya admin).
- Tampilkan tabel dengan kolom: Waktu, Aktor, Peran, Aksi, Entitas, Detail.
- Filter: rentang tanggal, peran aktor, jenis aksi.
- Tidak ada tombol hapus — log bersifat append-only dari UI.

---

## 11. Optimistic Rollback yang Lebih Baik

### 11.1 Perubahan pada `createRepo<T>`

**Sebelum:** Saat mutasi gagal → toast error + full re-hydrate.

**Sesudah:** Simpan snapshot pre-mutasi, kembalikan jika server menolak.

```typescript
upsert(item: T): T {
  const previous = getList().slice();    // snapshot sebelum mutasi
  const next = previous.slice();
  upsertArrayItem(next, item);
  setList(next);                         // optimistic update segera

  enqueue("upsert", item, previous);     // kirim snapshot ke queue
  return item;
}

// Di dalam queue, jika gagal:
function notifyMutationFailure(entity, error, snapshot) {
  toast.error(`Gagal menyimpan ${entity}: ${error}`);
  if (snapshot) setList(snapshot);       // rollback ke state sebelumnya
  // Tidak perlu full re-hydrate lagi kecuali konflik kritis
}
```

---

## 12. Strategi Pengujian

### 12.1 Unit Test (sudah ada, diperluas)

Tambah unit test untuk:
- `rate-limit.ts` — sliding window counter
- `ip-check.ts` — CIDR matching
- `exam.ts` — `gradeSesi`, `recomputeSkor`, `buildSesi` dengan edge case
- `analisis.ts` — `analisisButir` dengan berbagai distribusi skor

### 12.2 Integration Test (baru)

Gunakan **Playwright** atau **supertest** terhadap server lokal:

| Skenario | Tipe |
|---|---|
| Login → snapshot boot → ujian → submit | E2E |
| Login gagal 5x → rate limit aktif → cooldown selesai → berhasil | Integrasi |
| Admin buat soal → operator restricted topik tidak melihat soal | Integrasi |
| Peserta coba buka ujian dari IP luar range → ditolak | Integrasi |
| Sesi expire saat ujian → auto-submit → status kedaluwarsa | Integrasi |
| Backup export → reset → import → verifikasi data | Integrasi |

### 12.3 Target Coverage

- Unit test: ≥ 90% untuk semua fungsi di `src/lib/cbt/` dan `src/lib/server/db/`.
- Integrasi: semua skenario kritis di atas.
- Manual: UI testing untuk semua alur peserta dan admin.

---

## 13. Konvensi & Panduan Kode

### 13.1 Pembatasan Import

| Modul | Boleh diimpor dari | Tidak boleh diimpor dari |
|---|---|---|
| `src/lib/cbt/` | Tidak ada import server | `src/lib/server/` |
| `src/lib/server/db/` | `@prisma/client`, node builtins | `src/lib/cbt/`, `src/routes/` |
| `src/lib/server/{domain}/functions.ts` | `src/lib/server/db/`, `src/lib/cbt/types` | Domain server lain |
| `src/routes/` | `src/lib/cbt/`, `src/components/` | `src/lib/server/` langsung |

### 13.2 Konvensi Penamaan File

- Server functions: `{domain}/functions.ts`
- Tipe domain: `src/lib/cbt/types.ts` (tetap satu file)
- Test: `tests/unit/{topik}.test.mjs` (unit), `tests/integration/{skenario}.test.ts` (integrasi)

### 13.3 ID Entitas

Semua ID entitas tetap menggunakan generator `uid(prefix)` yang sudah ada di `src/lib/server/db/id.ts`. Prefiks:
- User: `u_`, Group: `g_`, Modul: `mod_`, Topik: `top_`, Soal: `soal_`, Ujian: `ujian_`, Sesi: `se_`, Token: `tok_`, AuditLog: `aud_`

---

## 14. Kompatibilitas Mundur

- Format file backup JSON v1 tetap dapat diimpor di v2.
- `backup/functions.ts` menyertakan adapter yang mengonversi backup v1 (JSON-in-string) ke format v2 (relasional) saat import.
- Endpoint API publik tidak berubah (tidak ada API publik eksternal di v1/v2).
