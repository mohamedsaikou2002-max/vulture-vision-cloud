# Vulture Vision

Public market intelligence, Nasdaq analytics, news and socioeconomic scenario research. React/Vite frontend hosted on Netlify; Supabase database and Edge functions provide backend services. No workspace sign-in or Stripe payment is required.

## Develop

Use Node 22.12+ and npm. Run `npm ci`, copy `.env.example` to `.env.local`, set the two public Supabase variables, then run `npm run dev`. Server/provider credentials belong only in backend secret storage.

## Publish on Netlify

Follow [the Netlify release guide](docs/NETLIFY_RELEASE.md). Connect this repository's main branch; `netlify.toml` sets the build command, dist output, direct-route rewrites and asset headers. Configure public environment values in Netlify before the first build.

`npm run build:netlify` validates frontend configuration and builds. `npm run check:backend` checks the connected backend; add `-- --ai` for one real AI request. After deployment run `npm run check:site -- https://YOUR-SITE.netlify.app`.

Read [the live schema/error repair steps](docs/LIVE_ERROR_REPAIR.md) if simulation history or translation columns are missing. A frontend deploy does not deploy Supabase or host the separate Python/Whisper services.

## Checks

`npm test`, `npm run test:deployment`, `npm run test:migrations`, `npm run lint`, and `npx tsc --noEmit -p tsconfig.app.json`. CI builds the Netlify target with public test configuration. Live provider and ingestion checks remain separate from fixture tests.


## Run in VS Code (Windows)

Download the complete `vscode-local-test-2026-11-07` branch ZIP, extract it, and open the repository folder in VS Code. With Node.js **22.12+** installed, use the integrated terminal:

```powershell
npm run setup:local
# Edit .env.local with the active Supabase project's PUBLIC URL and publishable key.
npm ci
npm run doctor:local
npm run dev
```

Open the local address printed by Vite (normally `http://localhost:5173`). Windows users can also run `.\start-vulture-vision.ps1` after editing their public configuration. Run `npm run verify:local` for source/build tests and `npm run check:backend -- --ai` to test actual backend/AI requests.

**Important:** A static build is not a live deployment. The current codebase still exposes the public workspace and has retired Stripe billing stubs. See [VS Code setup, testing and deployment](docs/VS_CODE_TEST_AND_DEPLOY.md) for Supabase project ownership checks, Netlify publishing, and limitations.
