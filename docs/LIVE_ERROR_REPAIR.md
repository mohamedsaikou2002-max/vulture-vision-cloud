# Repair the reported live errors

Live probes confirmed these failures on the connected project:
- public_workspace_jobs: HTTP 404 / PGRST205 (missing table).
- news_articles.translation_status: HTTP 400 / 42703 (missing column).
- vv-chat: HTTP 504 after about 40.7 seconds.
- vv-intel-brief latest: HTTP 200, no report.

## Deploy through Lovable's connected Supabase project

1. Sync GitHub main to the repair revision. Inspect the remote migration ledger. Apply `supabase/migrations/20261026020000_repair_history_translation.sql` to the connected database if this repair is outstanding. This targeted SQL is self-contained for the missing public simulation table/RPC and translation columns/cache/queue/functions. It is tested to be repeatable and preserves successful translations. It does not require blindly replaying old billing migrations or dropping RLS.
2. Deploy changed functions with shared modules: vv-autosim, vv-chat, vv-simulation-chat, vv-intel-brief and vv-news-translate. Keep public function JWT settings from supabase/config.toml. The repair sends a PostgREST schema reload notification.
3. Use a low-latency supported model. Defaults now use gemini-2.5-flash-lite and google/gemini-2.5-flash-lite. If hosted GEMINI_MODEL or LOVABLE_AI_MODEL overrides point at a slow/unavailable model, correct those secure backend settings. Configured model overrides still take priority. Do not retry ambiguous timed-out inference or cycle credentials except on provider 429.
4. Configure/schedule the translation worker with NEWS_TRANSLATION_WORKER_TOKEN and approved TRANSLATION_SOURCE_IDS. Invoke it server-side using x-news-translation-token, never expose that token in the frontend. Confirm vv_claim_translations and vv_finish_translation work and translated_title_en fills for permitted sources. The frontend hides untranslated foreign headline cards and shows one availability notice; filtering alone does not perform translation.
5. Publish the frontend. Test a new simulation, saved history and replay; a short real Intel question; a sourced report when AI is unavailable; actual AI synthesis when the provider is available; and a foreign headline becoming English after the worker runs.

Intel source digests explicitly state that AI interpretation is unavailable and carry no invented forecast/confidence. A sourced digest is not proof that AI inference has recovered. Source reports continue when the AI cache times out or is absent.

## What was changed

- Targeted idempotent schema repair for the confirmed missing objects.
- Atomic insert fallback when only the public claim RPC is missing; duplicate IDs still cannot start a second inference. A missing table still fails before a run starts with an actionable storage-deployment error.
- Low-latency native/gateway defaults; supported Gemini 2.5 requests disable extra reasoning. Provider failures remain errors; no unbounded retries.
- Source-backed report recovery independent of the AI cache, with explicit report-kind labels and fallback notices.
- English headline selection shared between reports and feed; untranslated cards no longer render as repeated blank placeholders.

No hosted database or function deployment was performed from this workspace: it has repository access but no Supabase/Lovable management connection. Pushing GitHub alone does not install the missing schema or configure/schedule the translation worker.
