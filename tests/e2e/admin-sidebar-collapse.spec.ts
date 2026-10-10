import { expect, test } from "@playwright/test";

test("admin sidebar can collapse to an icon rail and expand again", async ({ page }) => {
	await page.goto("/login-admin");
	await page.getByLabel("Username Staf").fill("admin");
	await page.getByLabel("Kata Sandi").fill(process.env.ADMIN_PASSWORD ?? "e2e-smoke");
	await page.getByRole("button", { name: "Masuk ke Panel Staf" }).click();
	await expect(page).toHaveURL(/\/admin$/);

	const sidebar = page.locator("aside");
	const collapseButton = page.getByRole("button", { name: "Ciutkan sidebar" });
	await collapseButton.focus();
	await page.keyboard.press("Enter");
	await expect(sidebar).toHaveCSS("width", "64px");
	await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
	await page.getByRole("button", { name: "Akademik & Pengguna" }).click();
	await expect(page.getByRole("link", { name: "Struktur Akademik" })).toBeVisible();

	const expandButton = page.getByRole("button", { name: "Lebarkan sidebar" });
	await expandButton.focus();
	await page.keyboard.press("Space");
	await expect(sidebar).toHaveCSS("width", "256px");
	const navigation = page.getByRole("navigation", { name: "Navigasi administrasi" });
	const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
	await page.getByRole("link", { name: "Struktur Akademik", exact: true }).click();
	await expect(navigation.locator('[aria-current="page"]')).toHaveText("Struktur Akademik");
	await expect(breadcrumb.locator('[aria-current="page"]')).toHaveText("Struktur Akademik");
	await page.getByRole("link", { name: "Kelas Mata Kuliah", exact: true }).click();
	await expect(navigation.locator('[aria-current="page"]')).toHaveText("Kelas Mata Kuliah");
	await expect(breadcrumb.locator('[aria-current="page"]')).toHaveText("Kelas Mata Kuliah");
	await page.goto("/admin/peserta/online");
	await expect(navigation.locator('[aria-current="page"]')).toHaveText("Pantau Ujian Live");
	await expect(breadcrumb.locator('[aria-current="page"]')).toHaveText("Pantau Ujian Live");
	await page.goto("/admin/peserta");
	await expect(navigation.locator('[aria-current="page"]')).toHaveText("Mahasiswa / Peserta");
	await expect(breadcrumb.locator('[aria-current="page"]')).toHaveText("Mahasiswa / Peserta");
});
