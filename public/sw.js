// App-shell service worker. Navigations: network first, cached shell offline.
// Hashed assets (/assets/*): cache first, since their URL changes with their content.
// Everything else (icons, the manifest): network first, cached copy offline.
// The kit (kit.thatsit.app) is network first too, because it is always-latest; its
// files are cached at install so the app starts offline. Those requests use CORS mode:
// an opaque response can't be checked with res.ok, so a failure could be cached.
// Other cross-origin requests are not touched.
// Install also caches the /assets/ files index.html references, and the dynamic chunk the
// entry names: the first load runs before this worker controls the page, so "fetch" never saw them.
// Lookups ignore Vary: module scripts send Origin, precached requests don't, and a
// "Vary: Origin" response would then never match offline.
// Bumping CACHE drops every older cache on activation.
const CACHE = "app-v1";
const SHELL = ["/", "/manifest.webmanifest", "/icons/icon.svg"];
// Module scripts send an Origin header that precached requests lack; a "Vary: Origin" response would then never match.
const MATCH = { ignoreVary: true };
const KIT_ORIGIN = "https://kit.thatsit.app";
const KIT = ["kit.css", "kit.js", "lit.js", "theme-init.js"].map((f) => `${KIT_ORIGIN}/${f}`);

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches.open(CACHE).then(async (c) => {
			await c.addAll(SHELL);
			// The first load happens before this worker controls the page, so its hashed assets were never seen by "fetch".
			const html = await (await c.match("/")).text();
			const entries = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
			await c.addAll(entries);
			// Chunks the entry imports dynamically (main.ts splits the app from the kit import) are named "./x.js" in it.
			for (const e of entries.filter((e) => e.endsWith(".js"))) {
				const js = await (await c.match(e)).text();
				await c.addAll([...js.matchAll(/["'`]\.\/([\w.-]+\.js)["'`]/g)].map((m) => `/assets/${m[1]}`));
			}
			await Promise.all(KIT.map((u) => c.add(new Request(u, { mode: "cors" }))));
		}),
	);
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
			.then(() => self.clients.claim()),
	);
});

self.addEventListener("fetch", (event) => {
	const req = event.request;
	const url = new URL(req.url);
	const kit = url.origin === KIT_ORIGIN;
	if (req.method !== "GET" || (url.origin !== self.location.origin && !kit)) return;
	if (req.mode === "navigate") {
		event.respondWith(
			fetch(req)
				.then((res) => {
					// Never let an error page (a 502 from a proxy, say) replace the cached shell.
					if (res.ok) {
						const copy = res.clone();
						caches.open(CACHE).then((c) => c.put("/", copy));
					}
					return res;
				})
				.catch(() => caches.match("/")),
		);
		return;
	}
	const fromNetwork = () =>
		fetch(req).then((res) => {
			if (res.ok) {
				const copy = res.clone();
				caches.open(CACHE).then((c) => c.put(req, copy));
			}
			return res;
		});
	if (!kit && url.pathname.startsWith("/assets/")) {
		event.respondWith(caches.match(req, MATCH).then((hit) => hit || fromNetwork()));
		return;
	}
	event.respondWith(fromNetwork().catch(() => caches.match(req, MATCH).then((hit) => hit || Response.error())));
});
