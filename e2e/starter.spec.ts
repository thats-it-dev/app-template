import { expect, test } from "./csp.ts";

// Tests the starter <section>; delete this file when you replace it.
test("starter sheet and toast work", async ({ page }) => {
	await page.goto("/");
	const sheet = page.locator("tk-sheet");
	const isOpen = () => sheet.evaluate((el) => (el as unknown as { open: boolean }).open);
	await page.locator(".btn", { hasText: "Open sheet" }).click();
	await expect.poll(isOpen).toBe(true);
	await sheet.evaluate((el) => el.dispatchEvent(new CustomEvent("tk-close", { bubbles: true, composed: true })));
	await expect.poll(isOpen).toBe(false);
	await page.locator(".btn", { hasText: "Show toast" }).click();
	await expect(page.locator("tk-toasts").getByText("Saved")).toBeVisible();
});
