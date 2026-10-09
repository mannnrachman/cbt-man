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
});
