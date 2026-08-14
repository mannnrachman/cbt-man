import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
  UnitAkademikSchema,
  TahunAkademikSchema,
  SemesterSchema,
  MataKuliahSchema,
} from "../../src/lib/cbt/types.ts";

test("UnitAkademikSchema validates valid academic unit hierarchy", () => {
  const validFakultas = {
    id: "unit-1",
    nama: "Fakultas Kedokteran",
    tipe: "fakultas",
    parentId: null,
  };
  const parsed = UnitAkademikSchema.safeParse(validFakultas);
  assert.equal(parsed.success, true);
});

test("UnitAkademikSchema validates valid sub-unit prodi with parent", () => {
  const validProdi = {
    id: "unit-2",
    nama: "Pendidikan Dokter",
    tipe: "prodi",
    parentId: "unit-1",
  };
  const parsed = UnitAkademikSchema.safeParse(validProdi);
  assert.equal(parsed.success, true);
});

test("TahunAkademikSchema validates valid academic year", () => {
  const validTA = {
    id: "ta-2026",
    nama: "2025/2026",
    aktif: true,
  };
  const parsed = TahunAkademikSchema.safeParse(validTA);
  assert.equal(parsed.success, true);
});

test("SemesterSchema validates valid semester with tahunAkademikId", () => {
  const validSmt = {
    id: "smt-1",
    nama: "Ganjil 2025/2026",
    tahunAkademikId: "ta-2026",
  };
  const parsed = SemesterSchema.safeParse(validSmt);
  assert.equal(parsed.success, true);
});

test("MataKuliahSchema validates valid course", () => {
  const validMK = {
    id: "mk-1",
    kode: "KED101",
    nama: "Anatomi Dasar",
    sks: 3,
    unitId: "unit-2",
    semesterId: "smt-1",
  };
  const parsed = MataKuliahSchema.safeParse(validMK);
  assert.equal(parsed.success, true);
});
