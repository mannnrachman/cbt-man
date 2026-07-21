# Snapshot State v1

**Tanggal**: 15 Juli 2026
**Branch**: `main` sebelum migrasi ke `v2-dev`

## 1. Jumlah Baris Kode (SLOC)

Total baris kode di dalam direktori `src/` (hanya file `.ts` dan `.tsx`): **16.774 baris**.

## 2. Dependensi (package.json)

**Dependencies utama:**
- `@prisma/client`: `^6.16.2`
- `@radix-ui/react-*`: (berbagai komponen radix UI)
- `@tanstack/react-query`: `^5.83.0`
- `@tanstack/react-router`: `^1.168.25`
- `@tanstack/react-start`: `^1.167.50`
- `react`, `react-dom`: `^19.2.0`
- `tailwindcss`: `^4.2.1`
- `zustand`: `^5.0.14`
- `zod`: `^3.24.2`
- `vite`: `^7.3.1` (di devDependencies)
- `typescript`: `^5.8.3`

## 3. Daftar Route

Semua rute dalam aplikasi:

**Public Routes:**
- `src/routes/__root.tsx`
- `src/routes/index.tsx`
- `src/routes/login.tsx`

**API Routes:**
- `src/routes/api.files.$id.ts`

**Authenticated Routes (Layout):**
- `src/routes/_authenticated.tsx`

**Admin Routes:**
- `src/routes/_authenticated/admin.tsx` (Layout)
- `src/routes/_authenticated/admin.index.tsx`
- `src/routes/_authenticated/admin.evaluasi.tsx`
- `src/routes/_authenticated/admin.evaluasi.$id.tsx`
- `src/routes/_authenticated/admin.files.tsx`
- `src/routes/_authenticated/admin.hasil.tsx`
- `src/routes/_authenticated/admin.hasil.$id.tsx`
- `src/routes/_authenticated/admin.laporan.tsx`
- `src/routes/_authenticated/admin.laporan.analisis.tsx`
- `src/routes/_authenticated/admin.laporan.rekap.tsx`
- `src/routes/_authenticated/admin.leaderboard.index.tsx`
- `src/routes/_authenticated/admin.leaderboard.$id.tsx`
- `src/routes/_authenticated/admin.modul.tsx`
- `src/routes/_authenticated/admin.modul.$id.topik.tsx`
- `src/routes/_authenticated/admin.modul.import.tsx`
- `src/routes/_authenticated/admin.modul.import-word.tsx`
- `src/routes/_authenticated/admin.pengaturan.tsx`
- `src/routes/_authenticated/admin.peserta.tsx`
- `src/routes/_authenticated/admin.peserta.group.tsx`
- `src/routes/_authenticated/admin.peserta.kartu.tsx`
- `src/routes/_authenticated/admin.peserta.online.tsx`
- `src/routes/_authenticated/admin.tools.tsx`
- `src/routes/_authenticated/admin.topik.$id.soal.tsx`
- `src/routes/_authenticated/admin.ujian.tsx`
- `src/routes/_authenticated/admin.ujian.$id.tsx`
- `src/routes/_authenticated/admin.ujian.$id.peserta.tsx`
- `src/routes/_authenticated/admin.ujian.$id.token.tsx`
- `src/routes/_authenticated/admin.users.tsx`
- `src/routes/_authenticated/admin.users.roles.tsx`

**Peserta Routes:**
- `src/routes/_authenticated/peserta.tsx` (Layout)
- `src/routes/_authenticated/peserta.index.tsx`
- `src/routes/_authenticated/peserta.ujian.$id.tsx`
- `src/routes/_authenticated/peserta.ujian.$id.kerjakan.tsx`
- `src/routes/_authenticated/peserta.ujian.$id.hasil.tsx`
