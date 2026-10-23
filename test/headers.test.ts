import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseHeaders } from "../vite/headers.ts";

describe("parseHeaders", () => {
	it("skips comments and reads several path blocks", () => {
		const h = parseHeaders("# note\n/*\n  A: 1\n  # inner\n  B: x: y\n\n/theme/*\n  C: 3\n");
		expect(h).toEqual({ "/*": { A: "1", B: "x: y" }, "/theme/*": { C: "3" } });
	});
});

describe("public/_headers", () => {
	const h = parseHeaders(readFileSync(new URL("../public/_headers", import.meta.url), "utf8"))["/*"];
	const csp = h["Content-Security-Policy"];

	it.each([
		"default-src 'self'",
		"script-src 'self' https://kit.thatsit.app",
		"style-src 'self' 'unsafe-inline' https://kit.thatsit.app",
		"font-src https://kit.thatsit.app",
		"img-src 'self' data: blob:",
		"connect-src 'self' https://kit.thatsit.app",
		"manifest-src 'self'",
		"worker-src 'self'",
		"base-uri 'none'",
		"form-action 'none'",
	])("CSP contains %s", (part) => {
		expect(csp).toContain(part);
	});

	it("caches hashed assets for a year", () => {
		const all = parseHeaders(readFileSync(new URL("../public/_headers", import.meta.url), "utf8"));
		expect(all["/assets/*"]["Cache-Control"]).toBe("public, max-age=31536000, immutable");
	});

	it("sets the other security headers", () => {
		expect(h["X-Content-Type-Options"]).toBe("nosniff");
		expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
	});
});
