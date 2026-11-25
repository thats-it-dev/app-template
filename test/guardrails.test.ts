// Checks on the repo itself rather than on app behaviour. They run with `npm test`, so an agent meets them
// on every local run, not only in CI. AGENTS.md explains each rule.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// GUARDRAILS_ROOT points the checks at another checkout (a dry run over an app from the template); default: this repo.
const root = process.env.GUARDRAILS_ROOT ?? join(import.meta.dirname, "..");

function files(dir: string, ext: RegExp): string[] {
	return readdirSync(join(root, dir), { recursive: true, withFileTypes: true })
		.filter((e) => e.isFile() && ext.test(e.name))
		.map((e) => relative(root, join(e.parentPath, e.name)));
}

const read = (file: string) => readFileSync(join(root, file), "utf8");

describe("guardrails", () => {
	it("package.json name matches app.config.json name", () => {
		const pkg = JSON.parse(read("package.json")).name;
		const app = JSON.parse(read("app.config.json")).name;
		expect(pkg, "set package.json (and package-lock.json) name to the app name").toBe(app);
	});

	it("docs/spec.md is written, not the starter", () => {
		if (JSON.parse(read("package.json")).name === "app-template") return;
		let spec = "";
		try {
			spec = read("docs/spec.md");
		} catch {}
		expect(spec, "write docs/spec.md (see AGENTS.md, Spec)").not.toBe("");
		expect(spec.includes("starter spec:"), "docs/spec.md is still the starter: replace every section from Michael's request").toBe(false);
	});

	it("CI's Playwright image matches the @playwright/test version", () => {
		const want = JSON.parse(read("package.json")).devDependencies?.["@playwright/test"];
		const image = /mcr\.microsoft\.com\/playwright:v([\d.]+)-/.exec(read(".github/workflows/deploy.yml"))?.[1];
		expect(image, "set the container tag in .github/workflows/deploy.yml to v<@playwright/test version>-noble").toBe(want);
	});

	// Styles may only use tokens the kit defines (AGENTS.md lists them). A made-up name such as --tk-accent-fill
	// resolves to nothing, so the element renders without colour, border or fill, and no test sees it.
	it("CSS custom properties come from the kit", () => {
		let kitCss = "";
		try {
			kitCss = read(".kit/kit.css");
		} catch {}
		expect(kitCss, "run `npm run kit-types` first; it fetches the kit's stylesheet into .kit/").not.toBe("");
		const kit = new Set([...kitCss.matchAll(/--([A-Za-z][\w-]*)\s*:/g)].map((m) => m[1]));
		const sources = [...files("src", /\.(?:ts|js|css|html)$/), "index.html"];
		const unknown: string[] = [];
		for (const f of sources) {
			const text = read(f);
			// A property the app sets itself (e.g. `--cols: 4` on a grid) may be read in the same app.
			const own = new Set([...text.matchAll(/--([A-Za-z][\w-]*)\s*:/g)].map((m) => m[1]));
			for (const m of text.matchAll(/var\(\s*--([A-Za-z][\w-]*)/g)) {
				if (!kit.has(m[1]) && !own.has(m[1])) unknown.push(`${f}: --${m[1]}`);
			}
		}
		const colours = [...kit].filter((t) => !/^(?:font|safe|sidebar|aside|radius)/.test(t)).map((t) => `--${t}`).join(", ");
		expect([...new Set(unknown)], `the kit defines no such token (AGENTS.md, Styling); colours are ${colours}; shape and type are --radius, --font-body, --font-display, --font-mono`).toEqual([]);
	});

	// Styles and markup stay on the kit (AGENTS.md, Code rules): colours, type and shape come from tokens, icons and
	// dialogs from the kit, and every <tk-…> element is one the kit (or this app) defines. A line that has to break a
	// rule ends in `kit-ok: <why>`; the reviewer reads the reasons. Lovable gates every generation the same way.
	it("app styles and markup stay on the kit", () => {
		let api: { elements?: string[] } = {};
		for (const dir of [root, join(import.meta.dirname, "..")]) {
			try {
				api = JSON.parse(readFileSync(join(dir, ".kit", "api.json"), "utf8"));
				break;
			} catch {}
		}
		expect(api.elements?.length, "run `npm run kit-types` first; it fetches the kit's api.json into .kit/").toBeTruthy();
		const kitElements = new Set(api.elements);
		let publicCss: string[] = [];
		try {
			publicCss = files("public", /\.css$/);
		} catch {}
		const sources = [...files("src", /\.(?:ts|js|css|html)$/), "index.html", ...publicCss];
		const own = new Set<string>();
		for (const f of sources) for (const m of read(f).matchAll(/customElements\.define\(\s*["']([a-z][\w-]*)["']/g)) own.add(m[1]);
		const rules: [RegExp, string][] = [
			[/(?:^|[\s:,(])#[0-9a-fA-F]{3,8}(?=[\s;,)!"'`]|$)|\b(?:rgba?|hsla?)\(/, "a colour literal; use a kit colour token (var(--primary), var(--text-muted), …)"],
			[/\bfont-family\s*:(?!\s*var\(--font-)/, "font-family; use var(--font-body), var(--font-display) or var(--font-mono)"],
			[/\bborder-radius\s*:(?!\s*(?:var\(--radius\)|0\b|inherit\b))/, "a border-radius value; use var(--radius), or 0"],
			[/--tk-[\w-]+\s*:/, "a --tk-* definition; the kit has no --tk-* tokens"],
			[/<svg(?=[\s>])|<path(?=[\s>/])/, "a pasted SVG; icons come from the kit (SETTINGS_ICON, ICONS[name], …), charts from tk-sparkline, tk-bars, …"],
			[/<dialog(?=[\s>])/, "a hand-built <dialog>; use tk-sheet with the .form pattern"],
		];
		const bad: string[] = [];
		for (const f of sources) {
			read(f)
				.split("\n")
				.forEach((line, i) => {
					if (/<meta\s[^>]*name=["']theme-color["']/.test(line) || /kit-ok:/.test(line)) return;
					for (const [re, why] of rules) if (re.test(line)) bad.push(`${f}:${i + 1}: ${why}`);
					for (const m of line.matchAll(/<(tk-[a-z][\w-]*)/g)) if (!kitElements.has(m[1]) && !own.has(m[1])) bad.push(`${f}:${i + 1}: <${m[1]}> is not a kit element (the kit defines ${[...kitElements].join(", ")})`);
				});
		}
		expect(bad, "AGENTS.md, Code rules: styling. A line that must stay ends in `kit-ok: <why>`").toEqual([]);
	});

	it("e2e tests do not sleep", () => {
		const sleeps = files("e2e", /\.ts$/).filter((f) => /\bwaitForTimeout\s*\(/.test(read(f)));
		expect(sleeps, "wait on a condition with expect(...).toPass() or a locator assertion instead").toEqual([]);
	});
});
