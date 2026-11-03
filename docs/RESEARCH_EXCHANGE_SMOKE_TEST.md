# Research exchange: VS Code and CI smoke test

The DARPA research exchange UI is an **offline JSON contract inspector**, not a bundled
DARPA engine. The example artifacts are synthetic fixtures with unverified status.

## Local test

Use Node.js 22 or later. In VS Code, open this repository and run:

```bash
npm ci
npx tsc --noEmit -p tsconfig.app.json
npm test
npm run build
npm run dev
```

Open the Vite URL shown in the terminal and navigate to `/simulations`.
The simulator route is public in this repository. Find the **DARPA research exchange** section.

1. Select each of the nine named source formats, click **Load synthetic sample**, then **Validate locally**.
2. Check that the result reports `UNVERIFIED EXTERNAL RESULT` and the chosen source and metric values.
3. Modify a count metric such as `"events": 50` to `"events": 1.5`; it should be rejected.
4. Add an arbitrary identifier such as `"person_id":"123"`; it should be rejected.
5. Change `"imported_status"` to `"VERIFIED"`; it should be rejected.
6. Run the separate synthetic SocialSim-inspired cascade and confirm it is labeled `SYNTHETIC / UNVALIDATED`.

The fixtures validate **import format and UI wiring**, not calculations or availability
of the nine source engines. External MACM, RHPC_SMPLE, Armory, ATLANTIS,
DragonRadio, BenchQ, pyLIQTR, angr and OpenROAD workers must be separately installed,
licensed, secured and tested before real output can be supplied. RF/SDR,
quantum, GPU and MPI execution is not exercised by the browser fixtures.

The complete deployed backend, environment-specific Supabase configuration,
real upstream engine availability, and customer production operations require
independent end-to-end verification. GitHub Actions pass/fail status is not an
attestation of those external systems.
