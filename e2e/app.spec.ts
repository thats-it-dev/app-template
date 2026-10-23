import { expect, test, type Page } from "@playwright/test";

const KIT = "https://kit.thatsit.app/";

// Installed before load so violations during startup are seen too.
test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => {
		const w = window as unknown as { __csp: string[] };
		w.__csp = [];
		document.addEventListener("securitypolicyviolation", (e) => w.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
	});
});

test.afterEach(async ({ page }) => {
	const violations = await page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? []).catch(() => []);
	expect(violations).toEqual([]);
});

test("renders the kit shell", async ({ page }) => {
	await page.goto("/");
	await expect(page.locator("tk-shell")).toBeVisible();
	await expect(page.locator("tk-header")).toContainText("App template");
	const sheet = page.locator("tk-sheet");
	const isOpen = () => sheet.evaluate((el) => (el as unknown as { open: boolean }).open);
	await page.locator(".btn", { hasText: "Open sheet" }).click();
	await expect.poll(isOpen).toBe(true);
	await sheet.evaluate((el) => el.dispatchEvent(new CustomEvent("tk-close", { bubbles: true, composed: true })));
	await expect.poll(isOpen).toBe(false);
	await page.locator(".btn", { hasText: "Show toast" }).click();
	await expect(page.locator("tk-toasts").getByText(/\S/).first()).toBeVisible();
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
const appBtn = (page: Page) => page.evaluate(`(${PICK})(document.querySelector("app-main").shadowRoot.querySelector("button.btn:not(.ghost)"))`);
// The demo's own light-DOM buttons don't get sharedStyles, so build the kit's primary button in a shadow root on its page.
const kitBtn = (page: Page) =>
	page.evaluate(`(async () => {
		const { sharedStyles } = await import("./kit.js");
		const root = document.body.appendChild(document.createElement("div")).attachShadow({ mode: "open" });
		root.adoptedStyleSheets = [sharedStyles.styleSheet];
		root.innerHTML = '<button class="btn">Open sheet</button>';
		return (${PICK})(root.firstElementChild);
	})()`);

for (const colorScheme of ["light", "dark"] as const) {
	test(`matches the kit look (${colorScheme})`, async ({ page, browser }, info) => {
		const ctx = await browser.newContext({ ...info.project.use, colorScheme });
		const kit = await ctx.newPage();
		await kit.goto(KIT);
		await expect(kit.locator("tk-header")).toBeVisible();
		const expected = { body: await bodyLook(kit), btn: await kitBtn(kit) };
		await ctx.close();
		await page.emulateMedia({ colorScheme });
		await page.goto("/");
		await expect(page.locator("tk-header")).toBeVisible();
		expect({ body: await bodyLook(page), btn: await appBtn(page) }).toEqual(expected);
	});
}

test("works offline after first load", async ({ page, context }) => {
	await page.goto("/");
	await expect(page.locator("tk-header")).toBeVisible();
	await page.evaluate(() => navigator.serviceWorker.ready);
	await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
	// The install step caches the kit files; wait until they are all in.
	await expect.poll(() => page.evaluate(async () => (await (await caches.open("app-v1")).keys()).length)).toBeGreaterThanOrEqual(7);
	await context.setOffline(true);
	await page.reload();
	await expect(page.locator("tk-header")).toBeVisible();
	expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain("Inter");
});

test("explains a missing kit", async ({ browser }, info) => {
	const ctx = await browser.newContext(info.project.use);
	const page = await ctx.newPage();
	await page.route(`${KIT}**`, (r) => r.abort());
	await page.goto("/");
	await expect(page.getByText("Couldn't load the kit")).toBeVisible();
	await ctx.close();
});
