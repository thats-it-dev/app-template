import { describe, expect, it } from "vitest";
import { manifestFor } from "../vite/app-plugin.ts";

const config = { name: "demo", title: "Demo app", description: "A demo", color: "#112233" };

describe("manifestFor", () => {
	const m = manifestFor(config) as Record<string, any>;

	it("maps the config fields", () => {
		expect(m.name).toBe("Demo app");
		expect(m.short_name).toBe("demo");
		expect(m.description).toBe("A demo");
		expect(m).toMatchObject({ id: "/", start_url: "/", scope: "/", display: "standalone", background_color: "#171717", theme_color: "#171717" });
	});

	it("lists four icons, one maskable, without cache busters", () => {
		expect(m.icons).toHaveLength(4);
		expect(m.icons.filter((i: any) => i.purpose === "maskable")).toHaveLength(1);
		for (const i of m.icons) expect(i.src).not.toContain("?");
	});
});
