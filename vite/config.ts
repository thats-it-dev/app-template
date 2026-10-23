import { readFileSync } from "node:fs";

export type AppConfig = { name: string; title: string; description: string; color: string };

// Same rule as the Pages project name and the subdomain.
const NAME = /^[a-z](?:[a-z0-9-]{0,28}[a-z0-9])?$/;
const COLOR = /^#[0-9A-Fa-f]{6}$/;

export function parseConfig(raw: unknown): AppConfig {
	if (typeof raw !== "object" || raw === null) throw new Error("app.config.json: expected an object");
	const r = raw as Record<string, unknown>;
	const str = (k: string): string => {
		const v = r[k];
		if (typeof v !== "string" || v.trim() === "") throw new Error(`app.config.json: "${k}" must be a non-empty string`);
		return v;
	};
	const name = str("name");
	if (!NAME.test(name)) throw new Error(`app.config.json: "name" must match ${NAME} (got "${name}")`);
	const color = str("color");
	if (!COLOR.test(color)) throw new Error(`app.config.json: "color" must be #RRGGBB (got "${color}")`);
	return { name, title: str("title"), description: str("description"), color };
}

export function loadConfig(path: string | URL = new URL("../app.config.json", import.meta.url)): AppConfig {
	return parseConfig(JSON.parse(readFileSync(path, "utf8")));
}
