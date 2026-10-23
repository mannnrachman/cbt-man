import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";
import * as XLSX from "xlsx";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL ?? `file:${path.resolve("prisma/e2e.db")}` } },
});
let modulId: string;
let destinationId: string;

function workbook(rows: Record<string, string>[]) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), "Soal");
  return {
    name: "soal.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: XLSX.write(book, { type: "buffer", bookType: "xlsx" }),
  };
}

async function upload(page: Page, rows: Record<string, string>[]) {
  await page.locator('input[accept=".xlsx,.xls"]').setInputFiles(workbook(rows));
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  modulId = `excel-test-${randomUUID()}`;
  destinationId = `${modulId}-tujuan`;
  await prisma.modul.create({
    data: {
      id: modulId,
      nama: modulId,
      topik: {
        create: [
          { id: `${modulId}-awal`, nama: "Topik awal" },
          { id: destinationId, nama: "Topik tujuan" },
        ],
      },
    },
  });
  await prisma.modul.create({ data: { id: `${modulId}-empty`, nama: `${modulId}-empty` } });
  await page.goto("/login-admin");
  await page.getByLabel("Username Staf").fill("admin");
  await page.getByLabel("Kata Sandi").fill(process.env.ADMIN_PASSWORD ?? "e2e-smoke");
  await page.getByRole("button", { name: "Masuk ke Panel Staf" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin/modul/import");
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: modulId, exact: true }).click();
  await page.getByRole("combobox").nth(1).click();
  await page.getByRole("option", { name: "Topik awal", exact: true }).click();
});

test.afterEach(async () => {
  if (modulId)
    await prisma.modul.deleteMany({ where: { id: { in: [modulId, `${modulId}-empty`] } } });
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("an empty module does not trap the user away from other topics", async ({ page }) => {
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: `${modulId}-empty`, exact: true }).click();
  await expect(page.getByRole("combobox").first()).toBeVisible();
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: modulId, exact: true }).click();
  await upload(page, [{ Soal: "Kembali ke modul bertopik", "Tipe Soal": "Essay" }]);
  await page.getByRole("button", { name: "Simpan Soal Valid (1)" }).click();
  await expect(
    page.getByText("1 soal berhasil disimpan ke bank soal", { exact: true }),
  ).toBeVisible();
  expect(await prisma.soal.count({ where: { topik: { modulId } } })).toBe(1);
});

test("saves valid question types to the currently selected topic after preview", async ({
  page,
}) => {
  if (!(await page.locator("html").evaluate((element) => element.classList.contains("dark")))) {
    await page.getByRole("button", { name: "Ganti tema" }).click();
  }
  await expect(page.locator("html")).toHaveClass(/dark/);
  await upload(page, [
    {
      Soal: "PG",
      "Opsi A": "Jakarta Pusat",
      "Opsi B": "Bandung",
      "Kunci Jawaban": "Jakarta Pusat",
      Pembahasan: "Penjelasan PG",
    },
    { Soal: "Multi", "Opsi A": "Satu", "Opsi B": "Dua", "Opsi C": "Tiga", "Kunci Jawaban": "A,C" },
    { Soal: "BS", "Tipe Soal": "BS", "Kunci Jawaban": "Salah" },
    { Soal: "Esai", "Tipe Soal": "Essay", "Tingkat Kesulitan": "3" },
    { Soal: "Invalid", "Opsi A": "Satu", "Opsi B": "Dua", "Kunci Jawaban": "E" },
    { Soal: "PG tanpa opsi", "Tipe Soal": "PG", "Kunci Jawaban": "A" },
  ]);
  await expect(page.getByRole("button", { name: "Simpan Soal Valid (4)" })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "Invalid" })).toContainText(
    "Kunci jawaban tidak cocok",
  );
  await expect(page.getByRole("row").filter({ hasText: "PG tanpa opsi" })).toContainText(
    "minimal 2 opsi",
  );
  const topicPicker = page.getByRole("combobox", { name: "Topik / Bab Tujuan *", exact: true });
  await topicPicker.press("Space");
  await page.getByRole("option", { name: "Topik tujuan", exact: true }).press("Enter");
  await expect(topicPicker).toContainText("Topik tujuan");
  await page.getByRole("button", { name: "Simpan Soal Valid (4)" }).click();
  await expect(
    page.getByText("4 soal berhasil disimpan ke bank soal", { exact: true }),
  ).toBeVisible();
  const saved = await prisma.soal.findMany({
    where: { topikId: destinationId },
    include: { jawaban: true },
    orderBy: { detail: "asc" },
  });
  expect(saved.map((soal) => [soal.detail, soal.tipe])).toEqual([
    ["BS", "bs"],
    ["Esai", "essay"],
    ["Multi", "multi"],
    ["PG", "pg"],
  ]);
  expect(saved[0].jawaban.filter((answer) => answer.benar).map((answer) => answer.detail)).toEqual([
    "Salah",
  ]);
  expect(saved[1].kesulitan).toBe("sulit");
  expect(
    saved[2].jawaban
      .filter((answer) => answer.benar)
      .map((answer) => answer.detail)
      .sort(),
  ).toEqual(["Satu", "Tiga"]);
  expect(saved[3].pembahasan).toBe("Penjelasan PG");
  expect(await prisma.soal.count({ where: { topikId: `${modulId}-awal` } })).toBe(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Import Soal dari Excel" })).toBeVisible();
  expect(await prisma.soal.count({ where: { topikId: destinationId } })).toBe(4);
});

test("a broken workbook clears the previous preview and shows a controlled error", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await upload(page, [{ Soal: "Esai sebelumnya", "Tipe Soal": "Essay" }]);
  await expect(page.getByRole("button", { name: "Simpan Soal Valid (1)" })).toBeVisible();
  await upload(page, []);
  await expect(
    page.getByText("File Excel kosong atau tidak terbaca", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Simpan Soal Valid/ })).toHaveCount(0);
  await upload(page, [{ Soal: "Esai sebelumnya", "Tipe Soal": "Essay" }]);
  await expect(page.getByRole("button", { name: "Simpan Soal Valid (1)" })).toBeVisible();
  await page.locator('input[accept=".xlsx,.xls"]').setInputFiles({
    name: "rusak.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  });
  await expect(
    page.getByText("File Excel tidak dapat dibaca. Gunakan template .xlsx atau .xls yang valid.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Simpan Soal Valid/ })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("a failed save stops the import and retry saves only the remaining rows", async ({ page }) => {
  await upload(page, [
    { Soal: "Tersimpan pertama", "Tipe Soal": "Essay" },
    { Soal: "Gagal sementara", "Tipe Soal": "Essay" },
    { Soal: "Menunggu giliran", "Tipe Soal": "Essay" },
  ]);
  await page.route("**/*", async (route) => {
    if (
      route.request().method() === "POST" &&
      route.request().postData()?.includes("Gagal sementara")
    ) {
      await route.abort("failed");
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Simpan Soal Valid (3)" }).click();
  await expect(
    page.getByText("Gagal menyimpan soal ke server. Silakan coba lagi.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Simpan Soal Valid (2)" })).toBeEnabled();
  expect(await prisma.soal.count({ where: { topik: { modulId } } })).toBe(1);
  await page.unrouteAll({ behavior: "wait" });
  await page.getByRole("button", { name: "Simpan Soal Valid (2)" }).click();
  await expect(
    page.getByText("2 soal berhasil disimpan ke bank soal", { exact: true }),
  ).toBeVisible();
  expect(await prisma.soal.count({ where: { topik: { modulId } } })).toBe(3);
});

test("a lost response after commit can be retried without duplicating the question", async ({
  page,
}) => {
  await upload(page, [{ Soal: "Respons hilang setelah commit", "Tipe Soal": "Essay" }]);
  let releaseResponse = () => {};
  const responseGate = new Promise<void>((resolve) => {
    releaseResponse = resolve;
  });
  let serverFinished = false;
  await page.route("**/*", async (route) => {
    if (
      route.request().method() === "POST" &&
      route.request().postData()?.includes("Respons hilang setelah commit")
    ) {
      await route.fetch();
      serverFinished = true;
      await responseGate;
      await route.abort("failed");
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Simpan Soal Valid (1)" }).click();
  try {
    await expect.poll(() => serverFinished).toBe(true);
    expect(await prisma.soal.count({ where: { topik: { modulId } } })).toBe(1);
    await expect(page.getByRole("combobox", { name: "Modul Tujuan", exact: true })).toBeDisabled();
    await expect(
      page.getByRole("combobox", { name: "Topik / Bab Tujuan *", exact: true }),
    ).toBeDisabled();
    await expect(page.getByRole("button", { name: "Menyimpan...", exact: true })).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Pilih File Excel", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Upload Gambar (Opsional)", exact: true }),
    ).toBeDisabled();
  } finally {
    releaseResponse();
  }
  await expect(
    page.getByText("Gagal menyimpan soal ke server. Silakan coba lagi.", { exact: true }),
  ).toBeVisible();
  await page.unrouteAll({ behavior: "wait" });
  await page.getByRole("button", { name: "Simpan Soal Valid (1)" }).click();
  await expect(
    page.getByText("1 soal berhasil disimpan ke bank soal", { exact: true }),
  ).toBeVisible();
  expect(await prisma.soal.count({ where: { topik: { modulId } } })).toBe(1);
});

test("the downloaded xlsx template and a legacy xls workbook both save four questions", async ({
  page,
}) => {
  const downloadEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download Template Standar (.xlsx)", exact: true })
    .click();
  const download = await downloadEvent;
  const templatePath = await download.path();
  if (!templatePath) throw new Error("Template download has no local path");
  const template = await readFile(templatePath);
  await page.locator('input[accept=".xlsx,.xls"]').setInputFiles({
    name: download.suggestedFilename(),
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: template,
  });
  await page.getByRole("button", { name: "Simpan Soal Valid (4)" }).click();
  await expect(page.getByRole("row")).toHaveCount(0);
  expect(await prisma.soal.count({ where: { topik: { modulId } } })).toBe(4);
  const legacyBook = XLSX.write(XLSX.read(template), { bookType: "biff8", type: "buffer" });
  await page.locator('input[accept=".xlsx,.xls"]').setInputFiles({
    name: "template-legacy.xls",
    mimeType: "application/vnd.ms-excel",
    buffer: legacyBook,
  });
  await page.getByRole("button", { name: "Simpan Soal Valid (4)" }).click();
  await expect(page.getByRole("row")).toHaveCount(0);
  expect(await prisma.soal.count({ where: { topik: { modulId } } })).toBe(8);
});
