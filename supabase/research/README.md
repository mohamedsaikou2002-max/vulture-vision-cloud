# Private research modules (not customer UI)

This directory contains source moved out of the Vulture Vision browser application:

- `cascade.ts` — bounded synthetic information-cascade research toy model.
- `exchange.ts` — validated, aggregate-only research artifact parser, with nine source formats.
- `samples.ts` — synthetic research testing fixtures.
- `historicalCorpus.json` — retained historical-event research dataset (47 entries).
- `*.test.ts` — research-module unit tests, preserved.

No provider integrations or DARPA engines were installed by this move. The library is for controlled internal research, **not** published browser controls. No public Edge Function imports these resources. Do not expose these files through open endpoints or the Vercel `public/` directory. Require authenticated, explicitly authorized server-side access if any future service uses them.

The customer-facing simulation workflow remains `src/pages/Simulator.tsx` (advanced) and `src/pages/SimpleSimulator.tsx` (basic). The unreferenced legacy `src/pages/Simulations.tsx` screen was removed because it imported and exposed the historical corpus. The UI panels for synthetic social-cascade experiments and aggregate research artifact inspection were removed rather than relocated to the server because they were React controls, not backend engines.

The research modules and dataset remain preserved in Git history and in this directory. Keep model warnings and evidence provenance in downstream analysis output.
