# app-template

GitHub template for small static PWAs on [thatsit.app](https://thatsit.app), built on the shared kit and hosted on Cloudflare Pages. Vite + TypeScript, installable, works offline after the first visit.

## New app

1. Edit `app.config.json`: `name` is the Pages project and the subdomain (`<name>.thatsit.app`), plus `title`, `description` and the icon `color`.
2. Run `npm run icons` to regenerate the icons from that color.
3. Replace the `<section>` in `src/app-main.ts` with your app.

## Rules

- Import the kit and Lit only by URL (`https://kit.thatsit.app/kit.js`, `https://kit.thatsit.app/lit.js`), never `from "lit"`: a second Lit copy breaks styles.
- No custom colors, fonts or radii. Use the kit tokens. The one exception is the icon color in `app.config.json`.
- Components and tokens are documented at https://kit.thatsit.app/.

## Scripts

`npm run dev`, `build`, `preview`, `typecheck` (tsc), `test` (vitest), `e2e` (Playwright, Chromium; set `BASE_URL` to test a deployed site instead of building locally), `icons`, `kit-types` (fetches the kit's `.d.ts` into `.kit/`; runs automatically before dev, build and typecheck).

## Deploys

`.github/workflows/deploy.yml` runs typecheck, tests and e2e, then uploads `dist` with wrangler:

- Push to `main`: production deploy of the Pages project `<name>`.
- Pull request: preview deploy of the branch. The link is posted as one sticky PR comment (updated on each push) and written to the job summary.
- Fork PRs have no secrets, so they run the checks but skip the deploy.

The org secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` supply the credentials.

## One-time setup per app

Use the `cf` CLI; find exact commands with `cf cli search "<task>"`.

1. Create the project with production branch `main`: `cf pages create <name>`.
2. Attach the custom domain `<name>.thatsit.app`: `cf pages domains create`.
3. Add a proxied CNAME `<name>` pointing to `<name>.pages.dev`: `cf dns records create`.

This is how kit.thatsit.app was set up. The thatsit-app pi skill (Phase 3) will do these steps automatically.
