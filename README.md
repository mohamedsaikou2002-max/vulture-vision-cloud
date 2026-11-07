# Vulture Vision

Public market intelligence, Nasdaq analytics, news and socioeconomic scenario research. React/Vite frontend hosted on Netlify; Supabase database and Edge functions provide backend services. Customer workspace requires Supabase Auth and a server-confirmed Stripe subscription. Checkout is kept disabled until live staging verification; the public landing and account pages remain accessible.

## Develop

Use Node 22.12+ and npm. Run `npm ci`, copy `.env.example` to `.env.local`, set the two public Supabase variables, then run `npm run dev`. Supabase Auth must be configured with email/password or Google OAuth, and the Stripe test-mode backend needs signed webhook validation before enabling checkout. Server/provider credentials belong only in backend secret storage.

## Publish on Netlify

For a new independent backend, start with [the standalone cutover guide](docs/STANDALONE_NETLIFY_SUPABASE_CUTOVER.md), then [the Netlify release guide](docs/NETLIFY_RELEASE.md). The older Lovable-managed backend must not be reused accidentally. Connect this repository's main branch; `netlify.toml` sets the build command, dist output, direct-route rewrites and asset headers. Configure public environment values in Netlify before the first build.

`npm run build:netlify` validates frontend configuration and builds. `npm run check:backend` checks the connected backend; add `-- --ai` for one real AI request. After deployment run `npm run check:site -- https://YOUR-SITE.netlify.app`.

Read [the live schema/error repair steps](docs/LIVE_ERROR_REPAIR.md) if simulation history or translation columns are missing. A frontend deploy does not deploy Supabase or host the separate Python/Whisper services.

## Checks

`npm test`, `npm run test:deployment`, `npm run test:migrations`, `npm run lint`, and `npx tsc --noEmit -p tsconfig.app.json`. CI builds the Netlify target with public test configuration. Live provider and ingestion checks remain separate from fixture tests.
