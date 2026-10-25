# app-template

GitHub template for small static PWAs on [thatsit.app](https://thatsit.app), built on the shared kit and hosted on Cloudflare Pages. Vite + TypeScript, installable, works offline after the first visit.

## New app

1. Edit `app.config.json`: `name` is the Pages project and the subdomain (`<name>.thatsit.app`), plus `title`, `description` and the icon `color`.
2. Run `npm run icons` to regenerate the icons from that color.
3. Replace the starter in `src/app-main.ts` with your app (see [Layouts](#layouts)), and delete `e2e/starter.spec.ts` (it tests the starter shell and buttons).

## Layouts

`<html data-shell>` in `index.html` is the switch. The kit's `kit.css` uses it to pin `html` and `body` to `height: 100%` with `overflow: hidden` and no overscroll, so the document never scrolls or bounces (iOS would drag the header with it) and only the app's own panes scroll. Without it the page scrolls normally.

- **Single page** (choose this for simple apps): remove `data-shell` from `index.html` and render content directly in `app-main`, with no `tk-shell` or `tk-header`. `tk-sheet`, `tk-toasts` and `sharedStyles` work as before.
- **App with navigation**: keep `data-shell` and the `tk-shell` + `tk-header` structure from the starter.

`app-main` must render into its shadow root (don't override `createRenderRoot`); the generic tests wait on that.

`e2e/app.spec.ts` is layout-agnostic and stays in every app; the shell assertions live in `e2e/starter.spec.ts`, which you delete with the starter section.

## Rules

- Import the kit and Lit only by URL (`https://kit.thatsit.app/kit.js`, `https://kit.thatsit.app/lit.js`), never `from "lit"`: a second Lit copy breaks styles.
- No custom colors, fonts or radii. Use the kit tokens. The one exception is the icon color in `app.config.json`.
- Components and tokens are documented at https://kit.thatsit.app/.

## Scripts

`npm run dev`, `build`, `preview`, `typecheck` (tsc), `test` (vitest), `e2e` (Playwright, Chromium; set `BASE_URL` to test a deployed site instead of building locally), `icons`, `kit-types` (fetches the kit's `.d.ts` into `.kit/`; runs automatically before dev, build and typecheck).

## Spark data (gateway)

Apps can read system stats and keep their own small JSON store on spark-gateway, a backend reachable only from Michael's tailnet.

1. Set `"gateway": true` in `app.config.json`. The build then defines `__GATEWAY_URL__` and adds the gateway origin to `connect-src` in `dist/_headers` (`public/_headers` stays as is). Without the flag nothing changes.
2. Import the client: `import { kv, system, OffTailnetError } from "./gateway.ts"` and `import "./tailnet-only.ts"`. `kv.get/put/del/list(collection, ...)` work on `/apps/<name>/kv/...` (your own store only); `system.models()`, `gpu()` and `sessions()` read stats. Ids match `[A-Za-z0-9_-]{1,128}`, collections `[a-z0-9-]{1,64}`, values are JSON objects up to 256 KiB.
3. Catch `OffTailnetError` (the request never got an answer) and render `<tk-tailnet-only @retry=${...}>`. A `GatewayError` (has `status`) is a real HTTP error, not a connectivity problem.

```ts
try {
	this.notes = await kv.list("notes");
} catch (e) {
	if (e instanceof OffTailnetError) this.offline = true;
	else throw e;
}
// render(): this.offline ? html`<tk-tailnet-only @retry=${() => this.load()}></tk-tailnet-only>` : ...
```

Tests never reach the gateway: stub it with `page.route("https://*.ts.net:*/**", ...)` (fulfill with JSON, or `abort()` for the off-tailnet state). `e2e/gateway.spec.ts` runs only when `gateway` is true.

PR previews: add a line `Gateway: thats-it-dev/spark-gateway#<N>` (N from 1 to 499) to the PR body to build the preview against that gateway PR's preview (port 9500+N). The sticky comment then shows `Gateway preview: <url>`.

## Deploys

`.github/workflows/deploy.yml` runs typecheck, tests and e2e, then uploads `dist` with wrangler:

- Push to `main`: production deploy of the Pages project `<name>`. The deploy is skipped while `name` is still `app-template` in a repo other than the template itself, so edit `app.config.json` first.
- Pull request: preview deploy of the branch. The link is posted as one sticky PR comment (updated on each push) and written to the job summary.
- Fork PRs have no secrets, so they run the checks but skip the deploy.

The org secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` supply the credentials.

## One-time setup per app

Use the `cf` CLI; find exact commands with `cf cli search "<task>"`.

1. Create the project with production branch `main`: `cf pages create <name>`.
2. Attach the custom domain `<name>.thatsit.app`: `cf pages domains create`.
3. Add a proxied CNAME `<name>` pointing to the project's `subdomain` from the `cf pages create` output (usually `<name>.pages.dev`, but Cloudflare adds a suffix such as `<name>-930.pages.dev` when that name is taken): `cf dns records create`.

This is how kit.thatsit.app was set up. The thatsit-app pi skill will do these steps automatically.
