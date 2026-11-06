# Publish Vulture Vision on Netlify

## Hosting layout

Netlify builds and serves the React/Vite frontend. The existing Supabase project serves Postgres, public data APIs and Edge functions. No Supabase Auth provider or Stripe configuration is needed by the workspace. AI/provider keys and the service-role key remain only in Supabase secrets. New simulation history is intentionally public; historical private records remain protected.

The Python crawler and Whisper gateway are separate long-running services. Netlify static hosting cannot run them. Cloud RSS collection is already part of vv-news; broader crawler ingestion, background context/translation and Whisper must each be deployed and checked separately. Browser speech remains the available fallback when VITE_VOICE_HOST is unset.

## 1. Prepare the existing backend

Read `docs/LIVE_ERROR_REPAIR.md`. Inspect the remote migration ledger and actual schema before applying changes. Deploy outstanding ordered Supabase migrations once; use the tested targeted repair `20261026020000_repair_history_translation.sql` when those objects are missing. Never replay old billing/schema migrations blindly.

Deploy Edge functions with shared modules and `supabase/config.toml` JWT settings. Public workspace functions must not request a user login. Translation/context workers and administrative operations keep their server-side authorization.

The repository includes a manual **Deploy Supabase functions** GitHub Actions workflow. Configure the repository secret `SUPABASE_ACCESS_TOKEN` and variable `SUPABASE_PROJECT_REF`, then run that workflow on main. This deploys functions only; it deliberately does not blindly run database migrations or change provider secrets. A service-role API key is not a substitute for the management access token.

Configure existing AI credentials, supported models, FRED where required, and worker tokens/source permissions in Supabase. Schedule the trusted translation/context workers on your backend host. Run:

```sh
npm ci
npm run check:backend
npm run check:backend -- --ai
```

The second command performs read-only live checks; the `--ai` command additionally makes one small inference request. PASS means only that named check passed. A sourced digest is not proof of working AI, and available translation columns are not proof the translation worker is running.

## 2. Connect GitHub to Netlify

In Netlify choose **Add new project → Import an existing project → GitHub** and select `mohamedsaikou2002-max/vulture-vision-cloud`, production branch `main`, base directory repository root.

The committed `netlify.toml` provides:

| Setting | Value |
|---|---|
| Build command | `npm run build:netlify` |
| Publish directory | `dist` |
| Node / npm | Node 22, npm 11 |
| Dependency installation | npm, using package-lock.json |

Set these build environment variables in Netlify, for production and any preview context you intend to test:

| Name | Required | Value |
|---|---|---|
| VITE_SUPABASE_URL | Yes | Existing project's HTTPS origin |
| VITE_SUPABASE_PUBLISHABLE_KEY | Yes | Public publishable key or legacy anon key |
| VITE_SUPABASE_PROJECT_ID | No | Matching project reference; optional consistency check |
| VITE_VOICE_HOST | No | Exact HTTPS voice gateway origin; omit for browser speech |
| VITE_BACKGROUND_VIDEO_URL | No | HTTPS video URL or local absolute path; default is /video.mp4 |

Vite embeds these values at build time: rebuild after changing them. Do not add Gemini, Stripe, worker tokens, database passwords or service-role secrets to VITE_ variables or Netlify's frontend build environment. Netlify scanning exempts only the explicitly public Supabase variable names; secret scanning remains enabled.

The tracked local `.env` and redundant Bun lock have been removed from version control. Keep local configuration in ignored `.env.local`. The original video is shipped inside public/; no Lovable-only asset endpoint is needed. The landing design is preserved and obsolete paid-membership metadata is removed.

Use Git-based deployment, not a raw drag-and-drop of dist: the headers and routing configuration live in netlify.toml. Existing static files are served normally; missing JS/images return 404 instead of HTML; application routes rewrite to index.html. Backend calls remain absolute Supabase HTTPS calls and do not require a Netlify API proxy.

## 3. Validate a deploy preview before promoting it

```sh
npm run test:deployment
npm test
npm run test:migrations
npm run build:netlify
npm run check:site -- https://YOUR-PREVIEW.netlify.app
npm run check:backend -- --ai
```

Check real browser flows on mobile, tablet and desktop: public landing/video, Intel, Nasdaq analytics/chart, Socio-Economics, News/English translations and broadcast links, full/Quick Nasdaq simulation, history/replay/questions, Research Chat and optional research panels. Refresh deep links directly. Verify there are no sign-in, anonymous signup or billing requests. Confirm errors recover, timestamps are real and public data is labeled appropriately. Never treat fixture browser tests as successful live provider verification.

Netlify's own offline build can be checked locally with `npx netlify-cli build --offline --context production`. Local `netlify dev` may require downloading Netlify's Edge runtime even when the application has no Netlify Edge functions; restricted-network failures there are separate from successful static build/config validation.

## 4. Voice and news services

Use `deployment/compose.yaml` on a suitable container/VPS host for the optional crawler/Whisper services. Set the voice gateway's `VOICE_ALLOWED_ORIGINS` to the exact production Netlify/custom-domain HTTPS origin. The gateway is public but validates audio and bounds inference; whisper-server remains internal to Docker. Supply a real model, configure HTTPS ingress and set VITE_VOICE_HOST before rebuilding the frontend.

Crawler and translation/context worker secrets stay on that backend host. Verify scheduling and actual new records/translated titles. Do not assume all publishers are accessible or translated because a process is running.

## 5. Release status and rollback

Promote the tested preview and configure the production domain/HTTPS in Netlify only after live feature checks pass. Netlify can restore a previous frontend deploy; database changes are additive and must not be reverted by deleting user data.

This repository configuration does not create or publish a Netlify site, supply a management token, apply hosted migrations, or start external services. Those actions require the connected account/backend access. Keep the release BLOCKED if those services cannot be verified. There is no Netlify management connection in the current coding environment, and the live Supabase checks could not reach the project from this environment during preparation.
