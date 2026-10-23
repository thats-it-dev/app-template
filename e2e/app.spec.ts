import type { Page } from "@playwright/test";
import { loadConfig } from "../vite/config.ts";
import { expect, test } from "./csp.ts";

const KIT = "https://kit.thatsit.app/";
const { title } = loadConfig();

test("renders the kit shell", async ({ page }) => {
	await page.goto("/");
	await expect(page.locator("tk-shell")).toBeVisible();
	await expect(page.locator("tk-header")).toContainText(title);
	await expect(page.locator("tk-sheet")).toBeAttached();
	await expect(page.locator("tk-toasts")).toBeAttached();
});

test("loads one Lit", async ({ page }) => {
	await page.goto("/");
	await expect(page.locator("tk-header")).toBeVisible();
	expect(await page.evaluate(() => (globalThis as unknown as { litElementVersions: string[] }).litElementVersions.length)).toBe(1);
});

// Evaluated in the page as source text, so it carries no transpiler helpers.
const PICK = `(el) => {
	const cs = getComputedStyle(el);
	return Object.fromEntries(["background-color", "font-family", "border-radius", "color"].map((p) => [p, cs.getPropertyValue(p)]));
}`;

const bodyLook = (page: Page) => page.evaluate(`(${PICK})(document.body)`);
// Neither page's own buttons are comparable (the demo's are unstyled light DOM, the app's may be gone), so
// build the kit's primary button the same way on both: a shadow-root host adopting sharedStyles.
const btnLook = (page: Page) =>
	page.evaluate(`(async () => {
		const { sharedStyles } = await import("https://kit.thatsit.app/kit.js");
		const root = document.body.appendChild(document.createElement("div")).attachShadow({ mode: "open" });
		root.adoptedStyleSheets = [sharedStyles.styleSheet];
		root.innerHTML = '<button class="btn">Button</button>';
		return (${PICK})(root.firstElementChild);
	})()`);

for (const colorScheme of ["light", "dark"] as const) {
	test(`matches the kit look (${colorScheme})`, async ({ page, browser }, info) => {
		const ctx = await browser.newContext({ ...info.project.use, colorScheme });
		const kit = await ctx.newPage();
		await kit.goto(KIT);
		await expect(kit.locator("tk-header")).toBeVisible();
		const expected = { body: await bodyLook(kit), btn: await btnLook(kit) };
		await ctx.close();
		await page.emulateMedia({ colorScheme });
		await page.goto("/");
		await expect(page.locator("tk-header")).toBeVisible();
		expect({ body: await bodyLook(page), btn: await btnLook(page) }).toEqual(expected);
	});
}

test("works offline after first load", async ({ page, context }) => {
	await page.goto("/");
	await expect(page.locator("tk-header")).toBeVisible();
	await page.evaluate(() => navigator.serviceWorker.ready);
	await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
	// The worker activates (and claims the page) only after install, which caches the precache list and the kit files.
	await context.setOffline(true);
	await page.reload();
	await expect(page.locator("tk-header")).toBeVisible();
	expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain("Inter");
});

test("explains a missing kit", async ({ page }) => {
	await page.route(`${KIT}**`, (r) => r.abort());
	await page.goto("/");
	await expect(page.getByText("Couldn't load the kit")).toBeVisible();
});
