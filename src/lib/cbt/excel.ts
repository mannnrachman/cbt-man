// Helper export Excel ringkas pakai SheetJS
import * as XLSX from "xlsx";

export function exportSheet(
  filename: string,
  sheets: { name: string; aoa: (string | number | null | undefined)[][]; merges?: XLSX.Range[] }[],
): void {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.aoa);
    
    if (s.merges) {
      ws['!merges'] = s.merges;
    }

    // Auto-calculate column widths
    const colWidths: { wch: number }[] = [];
    for (const row of s.aoa) {
      row.forEach((cell, i) => {
        const str = cell !== null && cell !== undefined ? cell.toString() : "";
        const len = str.length;
        const current = colWidths[i]?.wch || 10;
        // Cap max width at 60 characters so it doesn't get ridiculously wide for long paragraphs
        colWidths[i] = { wch: Math.min(Math.max(current, len + 2), 60) };
      });
    }
    ws['!cols'] = colWidths;
    
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  XLSX.writeFile(wb, filename);
}

// Strip HTML tags simple — biar ekspor Excel bersih
export function stripHtml(html: string): string {
  return (html || "")
    .replace(/<style[^>]*>.*?<\/style>/gi, "")
    .replace(/<script[^>]*>.*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

import type { Soal, Jawaban, TipeSoal, Kesulitan } from "./types.ts";
import { uid } from "./storage.ts";

export interface ParsedSoalRow {
  soal: Soal;
  valid: boolean;
  error?: string;
}

export function parseExcelSoalRows(
  rows: Record<string, unknown>[],
  topikId: string,
  imageMap: Record<string, string> = {},
): ParsedSoalRow[] {
  if (rows.length === 0) return [];

  const out: ParsedSoalRow[] = [];

  // Detect format: Horizontal (Standard) vs Vertical (Legacy)
  const firstRowKeys = Object.keys(rows[0] ?? {});
  const isHorizontal = firstRowKeys.some((k) =>
    /^(soal|pertanyaan|opsi\s*[a-e]|kunci)/i.test(k.trim()),
  );

  if (isHorizontal) {
    for (const r of rows) {
      const isiRaw = String(r.Soal ?? r.Pertanyaan ?? r.isi ?? r.Isi ?? "").trim();
      let gambarSrc = String(r.Gambar ?? r.gambar ?? "").trim();
      const kunciRaw = String(
        r["Kunci Jawaban"] ?? r.Kunci ?? r.kunci ?? r.Jawaban ?? "",
      ).toUpperCase().trim();
      const tingkatRaw = String(
        r["Tingkat Kesulitan"] ?? r["Tingkat Kesulitan Soal"] ?? r.Kesulitan ?? "2",
      ).trim();
      const pembahasanRaw = String(r.Pembahasan ?? r.pembahasan ?? r.Penjelasan ?? "").trim();

      if (gambarSrc && imageMap[gambarSrc.toLowerCase()]) {
        gambarSrc = imageMap[gambarSrc.toLowerCase()];
      }

      if (!isiRaw && !gambarSrc) continue; // Skip empty row

      let isi = isiRaw;
      if (gambarSrc) {
        isi = `<div class="mb-4"><img src="${gambarSrc}" alt="Gambar Soal" class="max-w-full h-auto rounded-md shadow-sm border border-slate-200 dark:border-slate-800" /></div>${isi}`;
      }

      let kesulitan: Kesulitan = "sedang";
      if (tingkatRaw === "1" || tingkatRaw.toLowerCase().includes("mudah")) kesulitan = "mudah";
      else if (tingkatRaw === "3" || tingkatRaw.toLowerCase().includes("sulit")) kesulitan = "sulit";

      const tipeField = String(r["Tipe Soal"] ?? r.Tipe ?? r.tipe ?? r["Jenis Soal"] ?? "").trim().toLowerCase();
      const isExplicitBS = tipeField.includes("bs") || tipeField.includes("benar") || tipeField.includes("true");

      const optionEntries: { letter: string; text: string }[] = [];
      ["A", "B", "C", "D", "E"].forEach((letter) => {
        const val = r[`Opsi ${letter}`] ?? r[`Opsi_${letter}`] ?? r[`Opsi${letter}`] ?? r[letter];
        if (val !== undefined && String(val).trim() !== "") {
          optionEntries.push({ letter, text: String(val).trim() });
        }
      });

      // Auto-populate Benar / Salah options if explicitly designated as BS and options were omitted
      if (optionEntries.length === 0 && isExplicitBS) {
        optionEntries.push({ letter: "A", text: "Benar" });
        optionEntries.push({ letter: "B", text: "Salah" });
      }

      const trimmedKunci = kunciRaw.trim();
      const wholeMatch = trimmedKunci
        ? optionEntries.find(
            (o) => o.text.trim().toLowerCase() === trimmedKunci.toLowerCase(),
          )
        : undefined;
      const rawTokens = wholeMatch
        ? [wholeMatch.letter]
        : kunciRaw
            .split(/[,;\s]+/)
            .map((s) => s.trim())
            .filter(Boolean);

      const resolvedLetters: string[] = [];
      for (const token of rawTokens) {
        const upperToken = token.toUpperCase();
        // 1. Direct letter match (A, B, C, D, E)
        if (["A", "B", "C", "D", "E"].includes(upperToken)) {
          resolvedLetters.push(upperToken);
          continue;
        }

        // 2. Exact or normalized text match with one of the options
        const matchedByText = optionEntries.find(
          (o) => o.text.trim().toLowerCase() === token.toLowerCase(),
        );
        if (matchedByText) {
          resolvedLetters.push(matchedByText.letter);
          continue;
        }

        // 3. True/False semantic resolution
        if (/^(benar|true|betul)$/i.test(token)) {
          const bsOpt = optionEntries.find((o) => /^(benar|true|betul)$/i.test(o.text.trim()));
          if (bsOpt) {
            resolvedLetters.push(bsOpt.letter);
            continue;
          }
        }
        if (/^(salah|false)$/i.test(token)) {
          const bsOpt = optionEntries.find((o) => /^(salah|false)$/i.test(o.text.trim()));
          if (bsOpt) {
            resolvedLetters.push(bsOpt.letter);
            continue;
          }
        }

        // Keep unrecognized token to report meaningful validation error
        resolvedLetters.push(upperToken);
      }

      const correctLetters = Array.from(new Set(resolvedLetters));

      let tipe: TipeSoal = "pg";
      let error: string | undefined = undefined;

      const isExplicitEssay = /^(essay|esai|uraian)$/i.test(tipeField);
      if (isExplicitEssay || optionEntries.length === 0) {
        tipe = "essay";
      } else if (
        isExplicitBS ||
        (optionEntries.length === 2 &&
          optionEntries.some((o) => /^(benar|true|b|betul)$/i.test(o.text.trim())) &&
          optionEntries.some((o) => /^(salah|false|s)$/i.test(o.text.trim())))
      ) {
        tipe = "bs";
      } else if (correctLetters.length > 1) {
        tipe = "multi";
      } else {
        tipe = "pg";
      }

      if (tipe !== "essay") {
        if (optionEntries.length < 2) {
          error = "Pilihan ganda minimal 2 opsi (Opsi A dan Opsi B)";
        } else if (correctLetters.length === 0) {
          error = "Kunci jawaban belum ditentukan";
        } else {
          // Validate that the key letters actually match existing options
          const existingLetters = new Set(optionEntries.map((o) => o.letter));
          const missingKey = correctLetters.find((letter) => !existingLetters.has(letter));
          if (missingKey) {
            error = `Kunci jawaban tidak cocok dengan pilihan opsi yang tersedia (${missingKey})`;
          }
        }
      }

      const jawaban: Jawaban[] =
        tipe === "essay"
          ? []
          : optionEntries.map((opt) => ({
              id: uid("j_"),
              detail: opt.text,
              benar: correctLetters.includes(opt.letter),
            }));

      const soal: Soal = {
        id: uid("s_"),
        topikId,
        detail: isi,
        tipe,
        kesulitan,
        audioPlayOnce: false,
        jawaban,
        pembahasan: pembahasanRaw,
        createdAt: Date.now(),
      };

      out.push({ soal, valid: !error, error });
    }
  } else {
    // Legacy Vertical Parsing Fallback
    let currentSoal: Soal | null = null;
    let currentError: string | undefined;

    const commitCurrentSoal = () => {
      if (!currentSoal) return;
      if (currentSoal.jawaban.length === 0) {
        currentSoal.tipe = "essay";
      } else {
        const correctCount = currentSoal.jawaban.filter((j) => j.benar).length;
        const isBs =
          currentSoal.jawaban.length === 2 &&
          currentSoal.jawaban.some((j) => /^(benar|true|b|betul)$/i.test(j.detail.trim())) &&
          currentSoal.jawaban.some((j) => /^(salah|false|s)$/i.test(j.detail.trim()));

        if (isBs) {
          currentSoal.tipe = "bs";
        } else {
          currentSoal.tipe = correctCount > 1 ? "multi" : "pg";
        }

        if (currentSoal.jawaban.length < 2) {
          currentError = "Soal pilihan ganda minimal 2 opsi jawaban";
        } else if (correctCount === 0) {
          currentError = "Kunci jawaban belum ditentukan (tidak ada opsi yang bernilai benar)";
        }
      }
      out.push({ soal: currentSoal, valid: !currentError, error: currentError });
      currentSoal = null;
      currentError = undefined;
    };

    for (const r of rows) {
      const jenis = String(r.Jenis ?? "").toUpperCase().trim();
      const kode = String(r.Kode ?? "").toUpperCase().trim();

      if (jenis === "SOAL" || kode === "Q") {
        commitCurrentSoal();
        let isi = String(r.Isi ?? "").trim();
        let gambarSrc = String(r.Gambar ?? "").trim();
        const tingkat = String(r["Tingkat kesulitan Soal"] ?? "2").trim();
        const pembahasan = String(r.Pembahasan ?? r.pembahasan ?? "").trim();

        if (gambarSrc && imageMap[gambarSrc.toLowerCase()]) {
          gambarSrc = imageMap[gambarSrc.toLowerCase()];
        }

        if (!isi && !gambarSrc) currentError = "Isi pertanyaan kosong";
        if (gambarSrc) {
          isi = `<div class="mb-4"><img src="${gambarSrc}" alt="Gambar Soal" class="max-w-full h-auto rounded-md shadow-sm border border-slate-200 dark:border-slate-800" /></div>${isi}`;
        }

        let kesulitan: Kesulitan = "sedang";
        if (tingkat === "1") kesulitan = "mudah";
        else if (tingkat === "3") kesulitan = "sulit";

        currentSoal = {
          id: uid("s_"),
          topikId,
          detail: isi,
          tipe: "pg",
          kesulitan,
          audioPlayOnce: false,
          jawaban: [],
          pembahasan,
          createdAt: Date.now(),
        };
      } else if (jenis === "JAWABAN" || kode === "A") {
        if (!currentSoal) continue;
        let isi = String(r.Isi ?? "").trim();
        let gambarSrc = String(r.Gambar ?? "").trim();
        const statusStr = String(r["Status Jawaban"] ?? "0").trim();
        const status =
          statusStr === "1" ||
          statusStr.toLowerCase() === "benar" ||
          statusStr.toLowerCase() === "true";

        if (gambarSrc && imageMap[gambarSrc.toLowerCase()]) {
          gambarSrc = imageMap[gambarSrc.toLowerCase()];
        }

        if (gambarSrc) {
          isi = `<div class="mb-2"><img src="${gambarSrc}" alt="Gambar Opsi" class="max-w-xs h-auto rounded shadow-sm border border-slate-200 dark:border-slate-800" /></div>${isi}`;
        }

        currentSoal.jawaban.push({
          id: uid("j_"),
          detail: isi,
          benar: status,
        });
      }
    }
    commitCurrentSoal();
  }

  return out;
}
