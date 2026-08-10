import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const REQUIRED_HEADINGS = [
  "## Ringkasan",
  "## Issue, PR terkait, dan riwayat",
  "## Scope dan non-goal",
  "## Keamanan, otorisasi, dan data",
  "## Prisma dan migrasi",
  "## Validasi yang benar-benar dijalankan",
  "## Hygiene check",
  "## Risiko dan rollback",
];

const REQUIRED_HISTORY_FIELDS = [
  "Issue/PR terkait",
  "Apakah ini replacement dari PR closed/stale? Jika ya, tulis nomor PR dan kontribusi yang diekstrak",
  "Mengapa perubahan ini tidak duplikat dari pekerjaan yang ada?",
];

export function contractErrors(body) {
  const errors = [];
  if (!body.trim()) return ["body PR kosong"];

  for (const heading of REQUIRED_HEADINGS) {
    if (!body.includes(heading)) errors.push(`bagian wajib hilang: ${heading}`);
  }

  if (
    /^\s*[-*]\s*(?:Masalah\s*\/\s*kebutuhan|Perubahan|Dalam scope|Tidak dalam scope|Risiko yang tersisa):\s*$/m.test(
      body,
    )
  ) {
    errors.push("body PR masih memuat placeholder yang belum diisi");
  }

  const historyLines = body.split(/\r?\n/).map((line) => line.trim().replace(/^[-*]\s*/, ""));
  for (const field of REQUIRED_HISTORY_FIELDS) {
    const empty = historyLines.some((line) => {
      if (!line.startsWith(field)) return false;
      const suffix = line.slice(field.length);
      if (suffix && !/^\s*:/.test(suffix)) return false;
      return suffix.replace(/^\s*:\s*/, "").trim() === "";
    });
    if (empty) errors.push(`field wajib belum diisi: ${field}`);
  }
  return errors;
}

function main() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) throw new Error("GITHUB_EVENT_PATH diperlukan untuk memeriksa body pull request");

  const event = JSON.parse(readFileSync(eventPath, "utf8"));
  const errors = contractErrors(event.pull_request?.body ?? "");
  if (errors.length === 0) {
    console.log("✅ Kontrak body pull request terisi.");
    return;
  }

  console.error("❌ Kontrak body pull request gagal:");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
