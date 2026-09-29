import { strict as assert } from "node:assert";
import { test } from "node:test";
import { parseExcelSoalRows } from "../../src/lib/cbt/excel.ts";

test("rejects multiple choice question when answer key refers to non-existent option", () => {
  const rows = [
    {
      No: 1,
      Soal: "Berapa 1 + 1?",
      "Opsi A": "2",
      "Opsi B": "3",
      "Kunci Jawaban": "C", // C does not exist
      "Tingkat Kesulitan": 1,
    },
  ];

  const results = parseExcelSoalRows(rows, "topik_1");
  assert.equal(results.length, 1);
  assert.equal(results[0].valid, false);
  assert.match(results[0].error || "", /Kunci jawaban tidak cocok dengan pilihan opsi yang tersedia/i);
});

test("accurately identifies Benar/Salah (BS) questions with Indonesian and English variations", () => {
  const rows = [
    {
      No: 1,
      Soal: "Matahari terbit dari timur.",
      "Opsi A": "Benar",
      "Opsi B": "Salah",
      "Kunci Jawaban": "A",
    },
    {
      No: 2,
      Soal: "Earth is flat.",
      "Opsi A": "True",
      "Opsi B": "False",
      "Kunci Jawaban": "B",
    },
  ];

  const results = parseExcelSoalRows(rows, "topik_1");
  assert.equal(results.length, 2);
  assert.equal(results[0].valid, true);
  assert.equal(results[0].soal.tipe, "bs");
  assert.equal(results[1].valid, true);
  assert.equal(results[1].soal.tipe, "bs");
});

test("extracts Pembahasan field from Excel row into soal.pembahasan", () => {
  const rows = [
    {
      No: 1,
      Soal: "Apa kepanjangan CBT?",
      "Opsi A": "Computer Based Test",
      "Opsi B": "Computer Basic Tech",
      "Kunci Jawaban": "A",
      Pembahasan: "CBT adalah singkatan dari Computer Based Test.",
    },
  ];

  const results = parseExcelSoalRows(rows, "topik_1");
  assert.equal(results.length, 1);
  assert.equal(results[0].valid, true);
  assert.equal(results[0].soal.pembahasan, "CBT adalah singkatan dari Computer Based Test.");
});

test("supports answer keys written as text matching the option (e.g. 'Benar' or 'Salah')", () => {
  const rows = [
    {
      No: 1,
      Soal: "1 + 1 = 2.",
      "Opsi A": "Benar",
      "Opsi B": "Salah",
      "Kunci Jawaban": "Benar",
    },
    {
      No: 2,
      Soal: "Ibukota Indonesia adalah Jakarta.",
      "Opsi A": "Jakarta",
      "Opsi B": "Bandung",
      "Kunci Jawaban": "Jakarta",
    },
  ];

  const results = parseExcelSoalRows(rows, "topik_1");
  assert.equal(results.length, 2);
  assert.equal(results[0].valid, true);
  assert.equal(results[0].soal.jawaban[0].benar, true);
  assert.equal(results[0].soal.jawaban[1].benar, false);

  assert.equal(results[1].valid, true);
  assert.equal(results[1].soal.jawaban[0].benar, true);
  assert.equal(results[1].soal.jawaban[1].benar, false);
});

test("supports explicit Tipe Soal BS without manual Opsi A/B columns", () => {
  const rows = [
    {
      No: 1,
      Soal: "Matahari berputar mengelilingi bumi.",
      "Tipe Soal": "BS",
      "Kunci Jawaban": "Salah",
    },
  ];

  const results = parseExcelSoalRows(rows, "topik_1");
  assert.equal(results.length, 1);
  assert.equal(results[0].valid, true);
  assert.equal(results[0].soal.tipe, "bs");
  assert.equal(results[0].soal.jawaban.length, 2);
  assert.equal(results[0].soal.jawaban[0].detail, "Benar");
  assert.equal(results[0].soal.jawaban[0].benar, false);
  assert.equal(results[0].soal.jawaban[1].detail, "Salah");
  assert.equal(results[0].soal.jawaban[1].benar, true);
});

test("supports multi-word answer keys matching option text", () => {
  const rows = [
    {
      No: 1,
      Soal: "Siapakah bapak internet dunia?",
      "Opsi A": "Vint Cerf & Bob Kahn",
      "Opsi B": "Tim Berners-Lee",
      "Kunci Jawaban": "Vint Cerf & Bob Kahn",
    },
    {
      No: 2,
      Soal: "Dimanakah Monas berada?",
      "Opsi A": "Jakarta Pusat",
      "Opsi B": "Surabaya Timur",
      "Kunci Jawaban": "jakarta pusat",
    },
  ];

  const results = parseExcelSoalRows(rows, "topik_1");
  assert.equal(results.length, 2);
  assert.equal(results[0].valid, true);
  assert.equal(results[0].soal.jawaban[0].benar, true);
  assert.equal(results[0].soal.jawaban[1].benar, false);

  assert.equal(results[1].valid, true);
  assert.equal(results[1].soal.jawaban[0].benar, true);
  assert.equal(results[1].soal.jawaban[1].benar, false);
});

test("rejects row with options but missing answer key without falsely converting to essay", () => {
  const rows = [
    {
      No: 1,
      Soal: "Soal tanpa kunci jawaban.",
      "Tipe Soal": "PG",
      "Opsi A": "Pilihan A",
      "Opsi B": "Pilihan B",
      "Kunci Jawaban": "",
    },
  ];

  const results = parseExcelSoalRows(rows, "topik_1");
  assert.equal(results.length, 1);
  assert.equal(results[0].valid, false);
  assert.equal(results[0].soal.tipe, "pg");
  assert.match(results[0].error || "", /Kunci jawaban belum ditentukan/i);
});

test("classifies row without options or with explicit Essay type as essay with empty jawaban", () => {
  const rows = [
    {
      No: 1,
      Soal: "Jelaskan proses siklus air secara singkat.",
      "Tipe Soal": "Essay",
      "Kunci Jawaban": "",
    },
    {
      No: 2,
      Soal: "Uraikan penyebab pemanasan global.",
      "Kunci Jawaban": "",
    },
  ];

  const results = parseExcelSoalRows(rows, "topik_1");
  assert.equal(results.length, 2);
  assert.equal(results[0].valid, true);
  assert.equal(results[0].soal.tipe, "essay");
  assert.equal(results[0].soal.jawaban.length, 0);

  assert.equal(results[1].valid, true);
  assert.equal(results[1].soal.tipe, "essay");
  assert.equal(results[1].soal.jawaban.length, 0);
});
