import { expect, test } from "@playwright/test";

test("admin header shows the current page and account identity", async ({ page }) => {
	await page.goto("/login-admin");
	await page.getByLabel("Username Staf").fill("admin");
	await page.getByLabel("Kata Sandi").fill(process.env.ADMIN_PASSWORD ?? "e2e-smoke");
	await page.getByRole("button", { name: "Masuk ke Panel Staf" }).click();
	await expect(page).toHaveURL(/\/admin$/);

	const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
	await expect(breadcrumb).toContainText("Dashboard");
	const account = page.getByRole("group", { name: "Akun Rahmawati Kusuma, M.Pd" });
	await expect(account).toContainText("RK");
	await expect(account).toContainText("Rahmawati Kusuma, M.Pd");
	await expect(account).toContainText("super_admin");
	await page.getByRole("button", { name: "Ganti tema" }).click();
	await expect(page.locator("header")).toHaveCSS("background-color", "rgb(255, 255, 255)");

	await page.goto("/admin/modul");
	await expect(breadcrumb).toContainText("Bank Soal & Berkas");
	await expect(breadcrumb).toContainText("Bank Soal");
	await page.setViewportSize({ width: 390, height: 844 });
	await expect(breadcrumb.getByText("Bank Soal", { exact: true })).toBeVisible();
	await expect(breadcrumb.getByText("Bank Soal & Berkas", { exact: true })).toBeHidden();
	await expect(page.getByRole("button", { name: "Buka menu navigasi" })).toBeVisible();
	await page.getByRole("button", { name: "Buka menu navigasi" }).click();
	await page.getByRole("link", { name: "Dashboard" }).click({ timeout: 5000 });
	await expect(page).toHaveURL(/\/admin$/);
	await expect(account).toBeHidden();
});
