import { expect, test } from "@playwright/test";

test("public landing is reachable", async ({ page }) => {
  const response = await page.goto("/", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Jadwal Ujian Hari Ini" })).toBeVisible();
});
