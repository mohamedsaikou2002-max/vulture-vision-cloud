# Vulture Vision: VS Code test package and deployment guide

This branch is a **local test kit**, not proof of a live deployment. It contains the entire original app when downloaded as the GitHub branch ZIP. It keeps the existing app source, migrations, Edge functions, voice/crawler deployment files, media and configuration.

## Fastest path: Windows / VS Code

1. Download this branch with GitHub **Code → Download ZIP**. Extract it fully. In VS Code choose **File → Open Folder** and open the extracted repository root (the folder containing `package.json`). Alternatively clone this branch with Git.
2. Install **Node.js 22.12+** (LTS) and VS Code. Open **Terminal → New Terminal** in that folder.
3. In PowerShell run `npm run setup:local` (or `node scripts/setup-local.mjs` before installing dependencies). The command creates `.env.local` only if missing and **never overwrites it**.
4. Edit `.env.local` with your intended **live or staging** `VITE_SUPABASE_URL` and **public** `VITE_SUPABASE_PUBLISHABLE_KEY`. The URL must use the same project as its publishable key. The optional `VITE_SUPABASE_PROJECT_ID` must match the URL. No service-role, Stripe, database or AI secrets go into `VITE_` keys or source files.
5. Run `npm ci`, then `npm run doctor:local`, then `npm run dev`. Open the **Local** URL printed by Vite, typically [http://localhost:5173](http://localhost:5173).
6. On Windows, you may instead run `.\start-vulture-vision.ps1` after editing `.env.local`; it installs dependencies, checks Supabase health and launches Vite. If PowerShell blocks scripts, use the three npm commands rather than changing system-wide execution policy.

### Test each route

`/` landing; `/welcome` public overview; `/dashboard` Intel/chat; `/analytics` Nasdaq; `/news` indexed news; `/socioeconomics` macro data; `/simulations/simple` Quick Sim; `/simulations` scenario simulation; `/research` Research Chat; `/account` current public-access status.

Run `npm run verify:local` to execute ESLint, TypeScript checks, Vitest, deployment tests, the Netlify production build and the disposable migration test. Then run `npm run check:backend` for a **read-only live backend check**, and `npm run check:backend -- --ai` for one actual AI provider request. Network/AI checks may incur provider usage and will fail if the backend is unavailable.

The app currently uses **public workspace access**, not a live paid Stripe gate. Existing `vv-billing` and `stripe-webhook` functions are retired stubs. Simply connecting Stripe to ChatGPT does not reactivate checkout or create Vulture Vision Stripe products. Do not publish paid-access advertising or accept subscription payments until a separate payment integration, database entitlements and signed webhook testing are complete.

## Important: Supabase project ownership mismatch

The committed `supabase/config.toml` references project `wfxjufhqdgzajidciwxb`. The currently connected Supabase account exposed only project `kfqyprcxnqiofzmwhxgg`, which was reported **inactive** at inspection. They are not interchangeable. Do **not** deploy migrations or functions to the other project just because it appears in an account list. First connect the account containing the intended live project (or explicitly configure a new project and reconcile migrations/data).

All app data and AI provider calls depend on the **correct active backend**. A successful Vite build does not mean news ingestion, simulation persistence, Nasdaq data, translations or AI are operating.

## Netlify frontend deployment

The repository has `netlify.toml`: Node 22, command `npm run build:netlify`, publish directory `dist`, SPA redirects and asset 404 protection.

1. In Netlify **Add new project → Import an existing project → GitHub**, choose `mohamedsaikou2002-max/vulture-vision-cloud`.
2. For a test deployment select the `vscode-local-test-2026-11-07` branch, or merge the PR after the automated tests pass and select `main`.
3. Define the public `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the **Netlify Site configuration → Environment variables**. Optionally set `VITE_SUPABASE_PROJECT_ID`. Never set private service credentials as `VITE_` values. Rebuild after any change.
4. Deploy, open the URL Netlify actually assigned (do not guess it), and run `npm run check:site -- https://YOUR-REAL-SITE.netlify.app`.
5. Check browser Developer Tools → Network and Console on each route and compare the result to `npm run check:backend`. Promote to a production domain only after real live checks pass.

## Supabase backend deployment

Backend functions are **not** hosted by Netlify. This repository already includes a manual GitHub Actions workflow `.github/workflows/deploy-supabase.yml`, but it requires a correctly scoped `SUPABASE_ACCESS_TOKEN` repository secret and `SUPABASE_PROJECT_REF` repository variable. Confirm project ownership and migration history before running it. Do not send tokens through chat or commit them. Supabase Edge functions also need their private AI/provider credentials in Supabase secret management.

For schema repairs follow `docs/LIVE_ERROR_REPAIR.md`. Do not replay old migrations blindly. Confirm the target project and deployed schema, then rerun `npm run check:backend` and the applicable authenticated/operational smoke tests. The optional Python news crawler and Whisper voice host require a separate service/container host and are not part of a Netlify static deploy.

## Current verification boundary

- Included: source code, local setup, TypeScript/ESLint/unit/migration/build commands, Netlify config, docs, backend files.
- Requires your project access: a running Supabase project with correct schema/functions/secrets, valid live provider configuration, Netlify site authorization, and any Stripe product/billing reimplementation.
- Not established by this package: a reachable live site, successful customer checkout, current news ingestion, real-model responses or production readiness.
