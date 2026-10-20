// vv-autosim — one input, everything else automatic.
// The user supplies a scenario (typed or spoken). This function: interprets it with Gemini, searches the
// indexed news network, estimates the 10-dimension economic state from live observables, runs the numerical
// engine, picks fees/slippage/leverage automatically, tests the six strategies, and has Gemini explain the
// numbers. Every response uses the same envelope: { ok:true, ... } or { ok:false, error:{code,message} }.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { parseAutoSimRequest, dailyLimit, boundedPaths } from "../_shared/autosim_request.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildWorldPulse } from "../_shared/world_pulse.ts";
import { parseAnalysis, validateAutoSimResult } from "../_shared/autosim_contract.ts";
import type { AutoSimResult } from "../_shared/autosim_types.ts";
import { generate, generateJSON, GeminiError } from "../_shared/gemini.ts";
import {
  AGENTS, DIMENSIONS, ENGINE_ASSUMPTIONS, ENGINE_VERSION, EVENT_SHOCKS, EVENT_TYPES, STRATEGY_IDS, STRATEGY_INFO,
  autoConfigure, backtest, buildBaseline, buyAndHold, clamp, dailyLogVol, marketConditions, mulberry32,
  runDimensionScenario, scenarioMonteCarlo, type Dim, type EventType, type RiskProfile, type Shock,
} from "../_shared/autosim_engine.ts";
import { NASDAQ_MARKET, loadNasdaqCandles, loadMacroObservables, type SourceStatus } from "../_shared/autosim_data.ts";

const cors = { ...corsHeaders, "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
const fail = (code: string, message: string, status: number) => json({ ok: false, error: { code, message } }, status);
const DISCLAIMER = "Scenario-conditional simulation using uncalibrated coefficients. Not a forecast, not investment advice. Trading, especially with leverage, can lose more than you intend to risk.";

const DIM_HELP = "fear↑=more fear; trust↑=more trust; liquidity↑=easier funding; volatility↑=larger swings; credit↑=easier credit; consumer_activity↑=stronger demand; inflation↑=more price pressure; employment↑=stronger labor market; growth↑=stronger output; default_risk↑=more borrower stress";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fail("method_not_allowed", "Use POST", 405);
  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > 20_000) return fail("payload_too_large", "Request body too large", 413);
    body = parseAutoSimRequest(JSON.parse(raw || "{}"));
  } catch { return fail("invalid_json", "Request body must be valid JSON", 400); }

  const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) return fail("configuration_error", "Supabase environment is not configured", 503);
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return fail("unauthorized", "Sign in required", 401);
  const { data: { user }, error: authErr } = await createClient(url, anon).auth.getUser(token);
  if (authErr || !user) return fail("unauthorized", "Invalid or expired session", 401);
  const sb = createClient(url, service);
  const action = typeof body.action === "string" ? body.action : "run";

  try {
    if (action === "world_state") return await worldState(sb);
    // New membership gating stays inactive until payment configuration is explicitly enabled.
    if (Deno.env.get("VV_REQUIRE_SUBSCRIPTION") === "true") {
      const { data: ok, error } = await sb.rpc("vv_autosim_has_access", { p_user_id: user.id });
      if (error) return fail("entitlement_check_failed", "Could not verify your subscription", 503);
      if (!ok) return fail("subscription_required", "An active subscription is required to run simulations", 402);
    }
    if (action === "interrogate") return await interrogate(sb, user.id, body);
    if (action === "run") return await run(sb, user.id, body);
    return fail("unknown_action", `Unknown action: ${action}`, 400);
  } catch (e) {
    if (e instanceof GeminiError) return fail(`gemini_${e.code}`, e.message, e.status);
    console.error("vv-autosim", e);
    return fail("internal_error", "The simulation could not be completed", 500);
  }
});

// ── world state (no Gemini, no quota) ────────────────────────
async function worldState(sb: SupabaseClient) {
  const [{ obs, status }, candles] = await Promise.all([loadMacroObservables(), loadNasdaqCandles()]);
  const all = { ...obs };
  if (candles.closes.length) all.market_vol_ann = { value: dailyLogVol(candles.closes, 30) * Math.sqrt(252), observed_at: candles.dates.at(-1), source: "yahoo:NASDAQ realized vol" };
  const b = buildBaseline(all);
  const evidence = await retrieveEvidence(sb, [], [], true);
  return json({ world_pulse: buildWorldPulse(b.baseline, b.neutral, evidence.selected), ok: true, as_of: new Date().toISOString(), baseline: b.baseline, detail: b.detail, neutral_dimensions: b.neutral, data_status: [...status, candles.status] });
}

// ── interpretation helpers ───────────────────────────────────
interface Interp {
  event_type: EventType; summary: string; is_hypothetical: boolean; horizon_days: number; asset: string;
  regions: string[]; sectors: string[]; search_keywords: string[]; shocks: Shock; shock_rationale: Record<string, string>;
  risk_profile: RiskProfile; confidence: number;
}
function heuristicInterp(text: string, horizonHint: number): Interp {
  const t = text.toLowerCase();
  const pick = (terms: string[]) => terms.some(x => t.includes(x));
  const type: EventType = pick(["cyber", "ransomware", "bank breach"]) ? "banking_cyberattack"
    : pick(["rate hike", "interest rate", "raise rates"]) ? "rate_hike"
    : pick(["oil", "energy", "gas supply"]) ? "energy_supply_shock"
    : pick(["recession", "slowdown", "layoffs"]) ? "demand_slowdown"
    : pick(["export", "tariff", "sanction", "trade war"]) ? "trade_restriction"
    : pick(["exchange collapse", "exchange failure", "exchange hack", "ftx"]) ? "crypto_exchange_failure"
    : pick(["war", "invasion", "missile", "conflict"]) ? "geopolitical_conflict"
    : pick(["liquidity", "credit crunch"]) ? "liquidity_crunch"
    : pick(["ban", "crackdown", "regulat"]) ? "regulatory_crackdown" : "generic";
  const words = Array.from(new Set(t.replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(w => w.length > 4))).slice(0, 6);
  return { event_type: type, summary: text.slice(0, 200), is_hypothetical: true, horizon_days: horizonHint, asset: NASDAQ_MARKET.label, regions: [], sectors: [], search_keywords: words, shocks: {}, shock_rationale: {}, risk_profile: "balanced", confidence: 0.3 };
}
function validateInterp(raw: Record<string, unknown>, horizonHint: number): Interp {
  const type = EVENT_TYPES.includes(raw.event_type as EventType) ? (raw.event_type as EventType) : "generic";
  const shocks: Shock = {};
  for (const d of DIMENSIONS) { const v = (raw.shocks as Record<string, unknown> | undefined)?.[d]; if (typeof v === "number" && Number.isFinite(v)) shocks[d] = clamp(v, -0.2, 0.2); }
  const arr = (x: unknown, n: number) => (Array.isArray(x) ? x.filter(s => typeof s === "string").slice(0, n).map(s => String(s).slice(0, 80)) : []);
  const rationale: Record<string, string> = {};
  for (const d of DIMENSIONS) { const v = (raw.shock_rationale as Record<string, unknown> | undefined)?.[d]; if (typeof v === "string") rationale[d] = v.slice(0, 160); }
  const h = typeof raw.horizon_days === "number" ? Math.round(raw.horizon_days) : horizonHint;
  return {
    event_type: type, summary: typeof raw.summary === "string" ? raw.summary.slice(0, 300) : "",
    is_hypothetical: true, horizon_days: clamp(h, 1, 30),
    asset: NASDAQ_MARKET.label,
    regions: arr(raw.regions, 6), sectors: arr(raw.sectors, 6), search_keywords: arr(raw.search_keywords, 8),
    shocks, shock_rationale: rationale,
    risk_profile: (["conservative", "balanced", "aggressive"] as const).includes(raw.risk_profile as RiskProfile) ? (raw.risk_profile as RiskProfile) : "balanced",
    confidence: typeof raw.confidence === "number" ? clamp(raw.confidence) : 0.5,
  };
}

// ── main run ─────────────────────────────────────────────────
// deno-lint-ignore no-explicit-any
async function run(sb: SupabaseClient, userId: string, body: Record<string, unknown>) {
  const scenario = typeof body.scenario === "string" ? body.scenario.trim() : "";
  if (scenario.length < 8 || scenario.length > 2000) return fail("invalid_scenario", "Describe the scenario in 8–2000 characters", 400);
  const jobId = typeof body.job_id === "string" && /^[0-9a-f-]{36}$/i.test(body.job_id) ? body.job_id : crypto.randomUUID();
  const parent = typeof body.parent_job_id === "string" && /^[0-9a-f-]{36}$/i.test(body.parent_job_id) ? body.parent_job_id : null;

  let parentResult: AutoSimResult | null = null;
  if (parent) {
    const { data: stored, error } = await sb.from('autosim_jobs').select('result,status').eq('id', parent).eq('user_id', userId).maybeSingle();
    if (error || !stored || stored.status !== 'completed') return fail('invalid_parent', 'Original simulation is unavailable', 400);
    try { parentResult = validateAutoSimResult(stored.result) as unknown as AutoSimResult; }
    catch { return fail('invalid_parent', 'Original simulation has invalid replay data', 400); }
    if (!parentResult.replay_spec || parentResult.engine_version !== ENGINE_VERSION) return fail('invalid_parent', 'Run a new baseline with the current engine before creating controlled variants', 409);
    if (scenario !== parentResult.scenario) return fail('invalid_parent', 'A controlled variant must retain the original scenario', 400);
  }

  const { data: claim, error: claimError } = await sb.rpc("vv_claim_autosim", {
    p_user_id: userId, p_job_id: jobId, p_scenario: scenario, p_parent_id: parent,
    p_limit: dailyLimit(Deno.env.get("VV_DAILY_SIM_LIMIT")),
  });
  if (claimError) return fail("history_unavailable", "Simulation history is unavailable; accept the prepared update first", 503);
  if (claim === "forbidden") return fail("forbidden", "Not your simulation", 403);
  if (claim === "invalid_parent") return fail("invalid_parent", "Original simulation is unavailable", 400);
  if (claim === "quota_exceeded") return fail("quota_exceeded", "Daily simulation limit reached", 429);
  if (claim === "existing") {
    const { data: existing } = await sb.from("autosim_jobs").select("status,result").eq("id", jobId).eq("user_id", userId).maybeSingle();
    if (existing?.status === "completed") return json({ ok: true, job_id: jobId, result: existing.result, replayed: true });
    return fail("job_in_progress", "This request has already been submitted; use a new run to try again", 409);
  }
  if (claim !== "claimed") return fail("history_unavailable", "Could not reserve simulation request", 503);
  const log: { status: string; at: string; note?: string }[] = [];
  const stage = async (status: string, note?: string) => {
    log.push({ status, at: new Date().toISOString(), note });
    const { error } = await sb.from("autosim_jobs").update({ status, stage_log: log, updated_at: new Date().toISOString() }).eq("id", jobId).eq("user_id", userId);
    if (error) throw new Error("Could not save simulation stage");
  };
  const warnings: string[] = [];
  try {
    // 1 — interpret
    await stage("interpreting");
    const horizonHint = clamp(Math.round(Number(body.horizon_days) || 30), 1, 30);
    let interp: Interp, model = "none";
    if (parentResult) {
      interp = { ...parentResult.interpretation, horizon_days: parentResult.horizon_days, search_keywords: [], shocks: parentResult.shocks.gemini || {} };
      model = parentResult.model;
    } else try {
      const { data, model: m } = await generateJSON<Record<string, unknown>>({
        system: "You convert a trader's scenario into structured economic inputs. Respond with JSON only.",
        prompt: `Scenario: """${scenario}"""\n\nThe simulated market is the ${NASDAQ_MARKET.label} index (${NASDAQ_MARKET.symbol}) — do not pick or output any asset.\n\nReturn JSON with keys: event_type (one of ${EVENT_TYPES.join(", ")}), summary (one sentence), is_hypothetical (true unless the scenario describes something already widely reported), horizon_days (1-30), regions (array), sectors (array), search_keywords (4-8 short lowercase words or phrases useful for searching news headlines), shocks (object: dimension -> number between -0.2 and 0.2 = how far the scenario moves that 0-1 dimension; omit unaffected dimensions), shock_rationale (object: dimension -> under 20 words), risk_profile ("balanced" unless the scenario text explicitly asks for conservative or aggressive), confidence (0-1).\nDimensions: ${DIMENSIONS.join(", ")}. Meaning: ${DIM_HELP}.`,
        maxOutputTokens: 1500, temperature: 0.2,
      });
      interp = validateInterp(data, horizonHint); model = m;
    } catch (e) {
      if (e instanceof GeminiError && (e.code === "rate_limited" || e.code === "not_configured")) throw e;
      warnings.push(`Gemini interpretation unavailable (${(e as Error).message}); used keyword rules and default event shocks instead.`);
      interp = heuristicInterp(scenario, horizonHint);
    }

    // 2 — evidence
    await stage("retrieving_evidence");
    const evidence = parentResult?.evidence || await retrieveEvidence(sb, interp.search_keywords, (body.article_ids as string[] | undefined) || []);
    if (evidence.status === "unavailable") warnings.push("News index could not be queried; this run uses no news evidence.");
    else if (evidence.status === "none_found") warnings.push("No matching headlines in the last 72 hours — treated as a hypothetical scenario.");

    // 3 — state
    await stage("estimating_state");
    const [{ obs, status: macroStatus }, candles] = parentResult
      ? [{ obs: {}, status: parentResult.state.data_status }, parentResult.replay_spec!.candles] as const
      : await Promise.all([loadMacroObservables(), loadCandles(interp.asset)]);
    const all = { ...obs };
    if (candles.closes.length) all.crypto_vol_ann = { value: dailyLogVol(candles.closes, 30) * Math.sqrt(365), observed_at: candles.dates.at(-1), source: `coinbase:${interp.asset} realized vol` };
    const { baseline, detail, neutral } = parentResult
      ? { baseline: parentResult.state.baseline, detail: parentResult.state.detail, neutral: parentResult.state.neutral_dimensions }
      : buildBaseline(all);
    if (neutral.length) warnings.push(`No fresh observations for: ${neutral.join(', ')}. Those dimensions use a neutral 0.5 default.`);
    const dataStatus: SourceStatus[] = parentResult ? parentResult.state.data_status : [...macroStatus, candles.status];
    if (parentResult) warnings.push('Controlled variant: original evidence, observations, candles, path counts and random seed are frozen. Only the requested shock and its derived responses change.');

    // 4 — simulate
    await stage("simulating");
    const injected: Shock = {};
    const inj = body.inject as { dimension?: string; delta?: number } | undefined;
    if (inj && DIMENSIONS.includes(inj.dimension as Dim) && typeof inj.delta === "number") injected[inj.dimension as Dim] = clamp(inj.delta, -0.2, 0.2);
    const applied: Shock = {};
    for (const d of DIMENSIONS) {
      const v = (parentResult ? (parentResult.shocks.applied[d] ?? 0) : (interp.shocks[d] ?? EVENT_SHOCKS[interp.event_type][d] ?? 0)) + (injected[d] ?? 0);
      if (v !== 0) applied[d] = clamp(v, -0.25, 0.25);
    }
    const horizon = interp.horizon_days;
    const seed = parentResult?.seed ?? crypto.getRandomValues(new Uint32Array(1))[0];
    const dimPaths = parentResult?.replay_spec?.dim_paths ?? boundedPaths(Deno.env.get('VV_DIM_PATHS'), 600, 600);
    const strategyPaths = parentResult?.replay_spec?.strategy_paths ?? boundedPaths(Deno.env.get('VV_STRAT_PATHS'), 200, 200);
    const dimRes = runDimensionScenario({ baseline, shocks: applied, horizonDays: horizon, paths: dimPaths, seed });
    const synthetic = candles.closes.length < 90;
    const baseVol = parentResult?.market.base_daily_vol ?? (synthetic ? 0.035 : dailyLogVol(candles.closes, 30));
    if (synthetic) warnings.push("No price history available; strategy tests start from a synthetic price of 100.");
    const mc = marketConditions(baseline, dimRes, baseVol, horizon);
    const endState = Object.fromEntries(DIMENSIONS.map(d => [d, dimRes.distribution[d].p50])) as Record<Dim, number>;
    const cfg = autoConfigure(baseline, endState, interp.risk_profile);
    if (parentResult) {
      cfg.cost.fee_bps = parentResult.execution.cost.fee_bps;
      cfg.rationale = cfg.rationale.map(line=>line.startsWith('Taker fee ')?`Taker fee ${cfg.cost.fee_bps} bps is frozen from the original run; funding ${cfg.cost.funding_bps_per_day} bps/day.`:line);
    }
    const bias = mc.riskOffShift > 0.015 ? -1 : mc.riskOffShift < -0.015 ? 1 : 0;
    const warm = synthetic ? Array.from({ length: 60 }, () => 100) : candles.closes;
    const scen = scenarioMonteCarlo({ warmupCloses: warm, mc, horizon, paths: strategyPaths, seed, cost: cfg.cost, bias });
    let historical: AutoSimResult["strategies"]["historical"] = null;
    if (!synthetic && candles.closes.length >= 150) {
      const start = Math.max(60, candles.closes.length - 240);
      historical = {
        window: { start: candles.dates[start], end: candles.dates[candles.dates.length - 1], days: candles.closes.length - 1 - start },
        note: "Replay of today's automatic settings on recent daily candles. Fixed rules, no parameter fitting, not predictive of future results.",
        buy_hold: buyAndHold(candles.closes, start),
        strategies: STRATEGY_IDS.map(id => STRATEGY_INFO[id].needsScenario
          ? { id, label: STRATEGY_INFO[id].label, available: false, reason: "Needs a scenario direction; scenario test only." }
          : { id, label: STRATEGY_INFO[id].label, available: true, ...backtest(candles.closes, start, id, cfg.cost) }),
      };
    }

    const resultCore = {
      engine_version: ENGINE_VERSION, model, as_of: new Date().toISOString(), scenario, seed, horizon_days: horizon,
      mode: "hypothetical" as const,
      interpretation: interp, evidence,
      state: { baseline, detail, neutral_dimensions: neutral, data_status: dataStatus },
      shocks: { applied, prior: EVENT_SHOCKS[interp.event_type], gemini: interp.shocks, injected },
      dimensions: { distribution: dimRes.distribution, trajectory: dimRes.trajectory },
      agents: dimRes.agent_response_mean,
      market: { asset: interp.asset, price_source: synthetic ? "synthetic_start_100" : "coinbase_daily_candles", base_daily_vol: baseVol, risk_off_shift: mc.riskOffShift, direction_bias: bias },
      execution: { ...cfg, auto: true },
      strategies: { scenario: scen.strategies, buy_hold_scenario: scen.buy_hold, historical },
      assumptions: ENGINE_ASSUMPTIONS, calibration_status: "uncalibrated", disclaimer: DISCLAIMER,
    };

    // 5 — explain
    await stage("analyzing");
    let analysis: AutoSimResult["analysis"] = null;
    try {
      const compact = {
        scenario, mode: resultCore.mode, horizon_days: horizon, asset: interp.asset,
        dimensions: Object.fromEntries(DIMENSIONS.map(d => [d, { start: +baseline[d].toFixed(2), median_end: +dimRes.distribution[d].p50.toFixed(2), p5: +dimRes.distribution[d].p5.toFixed(2), p95: +dimRes.distribution[d].p95.toFixed(2) }])),
        execution: cfg.cost,
        scenario_strategies: scen.strategies.map(s => ({ strategy: s.label, median_return_pct: +(s.median_return * 100).toFixed(1), p5_pct: +(s.p5_return * 100).toFixed(1), p95_pct: +(s.p95_return * 100).toFixed(1), prob_loss: +s.prob_loss.toFixed(2), prob_liquidation: +s.prob_liquidation.toFixed(2) })),
        buy_hold_median_pct: +(scen.buy_hold.median_return * 100).toFixed(1),
        headlines: evidence.selected.slice(0, 15).map(h => `${h.source}: ${h.title}`),
        warnings,
      };
      const { data } = await generateJSON<Record<string, unknown>>({
        system: "You explain the output of a numerical economic simulator to a fast-moving trader. Use ONLY numbers present in the data. Never invent probabilities, prices or returns. Call results 'simulated'. Be direct and brief.",
        prompt: `Data:\n${JSON.stringify(compact)}\n\nReturn JSON: headline (max 12 words), summary (max 110 words), drivers (3-5 short strings: which dimensions moved and why, citing the numbers), risks (2-4 strings), gaps (strings: missing data, uncorroborated assumptions, contradictions in headlines), what_would_change_this (2-3 strings), spoken_summary (max 55 words, plain speech, no symbols or markdown).`,
        maxOutputTokens: 1400, temperature: 0.3,
      });
      analysis = parseAnalysis(data);
      if (!analysis) warnings.push("The AI explanation had an invalid structure and was omitted. Numerical results remain available.");
    } catch (e) {
      warnings.push(`Gemini explanation unavailable (${(e as Error).message}). Numerical results are unaffected.`);
    }

    const result = { ...resultCore, analysis, warnings,
      replay_spec: { candles, dim_paths: dimPaths, strategy_paths: strategyPaths },
    };
    validateAutoSimResult(result);
    const { error: saveError } = await sb.from("autosim_jobs").update({ status: "completed", result, stage_log: [...log, { status: "completed", at: new Date().toISOString() }], completed_at: new Date().toISOString() }).eq("id", jobId).eq("user_id", userId);
    if (saveError) throw new Error("Could not save simulation result");
    return json({ ok: true, job_id: jobId, status: "completed", result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Simulation failed";
    await sb.from("autosim_jobs").update({ status: "failed", error: msg.slice(0, 500), stage_log: log, updated_at: new Date().toISOString() }).eq("id", jobId);
    throw e;
  }
}

// ── evidence retrieval ───────────────────────────────────────
// deno-lint-ignore no-explicit-any
async function retrieveEvidence(sb: SupabaseClient, keywords: string[], articleIds: string[] = [], recentAll = false) {
  const windowHours = 72;
  const since = new Date(Date.now() - windowHours * 3_600_000).toISOString();
  const kws = keywords.map(k => k.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim()).filter(k => k.length >= 3).slice(0, 8);
  const empty = { window_hours: windowHours, sources_reporting: 0, matched: 0, independent_sources: 0, selected: [] as { title: string; source: string; url: string; country: string; published_at: string | null; first_seen: string }[] };
  try {
    const signal = AbortSignal.timeout(8000);
    const { data: srcRows, error: e1 } = await sb.from("news_articles").select("source_id").gte("fetched_at", since).or('published_at.is.null,published_at.gte.' + since).limit(5000).abortSignal(signal);
    if (e1) throw e1;
    const sources_reporting = new Set((srcRows ?? []).map((r: { source_id: string }) => r.source_id)).size;
    if ((!kws.length && !articleIds.length && !recentAll) || !sources_reporting) return { ...empty, sources_reporting, status: sources_reporting ? "none_found" : "unavailable" };
    let query = sb.from("news_articles").select("id,title,source,source_id,source_country,canonical_url,published_at,fetched_at")
      .gte("fetched_at", since).or('published_at.is.null,published_at.gte.' + since);
    if (articleIds.length) query = query.in('id', articleIds);
    else if (!recentAll) query = query.or(kws.map(k => `title.ilike.%${k}%`).join(','));
    const { data, error } = await query.order('fetched_at', { ascending: false }).limit(300).abortSignal(signal);
    if (error) throw error;
    const seen = new Set<string>();
    const ranked = (data ?? []).filter((a: Record<string,string>) => {
      const published = a.published_at ? Date.parse(a.published_at) : null;
      const fetched = Date.parse(a.fetched_at);
      return Number.isFinite(fetched) && fetched >= Date.parse(since) && fetched <= Date.now() + 60000 && (published === null || (Number.isFinite(published) && published >= Date.parse(since) && published <= Date.now() + 60000)) && /^https?:\/\//.test(a.canonical_url);
    }).map((a: Record<string, string>) => {
      const title = a.title.toLowerCase();
      const hits = kws.filter(k => title.includes(k)).length;
      const ageH = (Date.now() - Date.parse(a.published_at ?? a.fetched_at)) / 3_600_000;
      return { a, score: hits + Math.exp(-Math.max(0, ageH) / 36) };
    }).sort((x: { score: number }, y: { score: number }) => y.score - x.score)
      .filter(({ a }: { a: Record<string, string> }) => { const k = a.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 60); if (seen.has(k)) return false; seen.add(k); return true; })
      .slice(0, 25);
    const selected = ranked.map(({ a }: { a: Record<string, string> }) => ({ title: a.title, source: a.source, url: a.canonical_url, country: a.source_country, published_at: a.published_at ?? null, first_seen: a.fetched_at, source_id: a.source_id }));
    return { window_hours: windowHours, sources_reporting, matched: (data ?? []).length, independent_sources: new Set(selected.map((s: { source_id: string }) => s.source_id)).size, selected: selected.map(({ source_id: _s, ...rest }: Record<string, unknown>) => rest) as typeof empty.selected, status: selected.length ? "found" : "none_found" };
  } catch (e) {
    console.error("evidence", e);
    return { ...empty, status: "unavailable" };
  }
}

// ── interrogate a simulated agent group ──────────────────────
// deno-lint-ignore no-explicit-any
async function interrogate(sb: SupabaseClient, userId: string, body: Record<string, unknown>) {
  const agent = typeof body.agent === "string" ? body.agent : "";
  const question = typeof body.question === "string" ? body.question.trim().slice(0, 400) : "";
  if (!(AGENTS as readonly string[]).includes(agent) || question.length < 3) return fail("invalid_request", "Choose an agent group and ask a question", 400);
  const { data: job } = await sb.from("autosim_jobs").select("user_id,status,result").eq("id", body.job_id).maybeSingle();
  if (!job || job.user_id !== userId) return fail("not_found", "Simulation not found", 404);
  if (job.status !== "completed") return fail("job_not_ready", "Run a simulation first", 409);
  const { data: claimed, error: quotaError } = await sb.rpc("claim_scenario_synthesis", { p_user_id: userId });
  if (quotaError) return fail("quota_unavailable", "Research quota is unavailable", 503);
  if (claimed !== true) return fail("quota_exceeded", "Hourly research limit reached (6 calls)", 429);
  const r = job.result;
  const { text } = await generate({
    system: `You speak as the simulated "${agent}" group inside a numerical model. You are NOT a real person or institution. Answer only from the model data given: your modelled response weights, the dimension values, and the scenario. Mention that this is simulated. Maximum 110 words. Never invent numbers.`,
    prompt: JSON.stringify({ scenario: r.scenario, agent, modelled_response_score: r.agents?.[agent], dimensions: Object.fromEntries(DIMENSIONS.map(d => [d, r.dimensions.distribution[d].p50])), question }),
    maxOutputTokens: 500, temperature: 0.4,
  });
  return json({ ok: true, simulated: true, agent, answer: text.trim() });
}
