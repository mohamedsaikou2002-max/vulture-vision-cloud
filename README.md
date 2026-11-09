# Vulture Vision

AI-assisted financial, geopolitical and socioeconomic intelligence with Nasdaq historical analytics, attributed news and scenario research. The original React/Vite interface is preserved. **Commercial production is not yet live.**

## Architecture and deploy target

- Frontend: **Vercel** (Vite build, `dist`, `vercel.json` SPA routes, owned custom domain after DNS verification).
- New backend: **Supabase** project `sqxnulqhmykvlgxxvhmt` for Auth, PostgreSQL, RLS and Edge Functions. At initial 2026-11-09 inspection this project was healthy but empty; migrations, functions and provider credentials must still be deployed.
- Billing: Stripe hosted Checkout and signed webhooks; premium access requires a server-confirmed subscription. **Checkout stays disabled until staging tests pass.**
- Separate compute: crawler, translation/context workers, optional Whisper.

**Start with [the Vercel + standalone Supabase release checklist](docs/VERCEL_RELEASE.md)** and [paid Auth/Stripe launch requirements](docs/AUTH_STRIPE_LAUNCH.md). The older Netlify guide and `netlify.toml` are retained for fallback only. Do not point the new site to the former Lovable backend or the older inactive Supabase project.

## Local development

Use Node 22.12+ and npm. Run `npm ci`, copy `.env.example` to `.env.local` (ignored by Git), and set the public Supabase URL/publishable key for the **same** project. Then run `npm run dev`.

Backend secrets such as Stripe, AI provider and service-role keys belong only in Supabase protected secrets, never in `VITE_` variables or repository files.

## Deploy and validate

```sh
npm run lint
npx tsc --noEmit -p tsconfig.app.json
npm test
npm run test:migrations
npm run test:deployment
npm run build:vercel
npm run check:backend -- --ai
npm run check:site -- https://YOUR-VERCEL-PREVIEW.vercel.app
```

Vercel static hosting does **not** run database migrations, deploy Edge Functions, configure Stripe webhooks or host the separate workers. Fixture tests are not evidence that live providers, subscription enforcement or licensed real-time data work.
