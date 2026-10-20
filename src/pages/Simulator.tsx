import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Mic, Square } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import VVLayout from "@/components/VVLayout";
import WorldState from "@/components/sim/WorldState";
import DimensionCanvas, { label } from "@/components/sim/DimensionCanvas";
import corpus from "@/data/historicalCorpus.json";
import { AGENTS, DIMENSIONS, AGENT_RESPONSES, type Dim } from "../../supabase/functions/_shared/autosim_engine";
import { ApiError, interrogateAgent, jobStatus, listJobs, loadJob, runSimulation, type AutoSimResult, type JobRow } from "@/lib/autoSimApi";
import { speak, stopSpeaking, useVoiceInput } from "@/hooks/useVoiceInput";
import "@/styles/simulator.css";

const STAGES = [
  ["interpreting", "Reading your scenario"],
  ["retrieving_evidence", "Searching the news network"],
  ["estimating_state", "Estimating the 10 dimensions from live data"],
  ["simulating", "Running scenarios and testing six strategies"],
  ["analyzing", "Writing the explanation"],
] as const;
const TABS = ["canvas", "forecast", "strategies", "agents", "history"] as const;
const EXAMPLES = [
  "What happens to crypto liquidity if semiconductor export restrictions expand?",
  "Fed hikes rates 50 bps unexpectedly next week",
  "A top-five crypto exchange halts withdrawals for 72 hours",
];
const pct = (v: number | null | undefined, d = 1) => (v == null || !Number.isFinite(v) ? "—" : `${(v * 100).toFixed(d)}%`);

export default function Simulator() {
  const [scenario, setScenario] = useState("");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<AutoSimResult | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [tab, setTab] = useState<typeof TABS[number]>("canvas");
  const [historyError, setHistoryError] = useState("");
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [parent, setParent] = useState<AutoSimResult | null>(null);
  const [handsFree, setHandsFree] = useState(() => localStorage.getItem("vv-handsfree") === "1");
  const [speakOn, setSpeakOn] = useState(() => localStorage.getItem("vv-speak") === "1");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [injDim, setInjDim] = useState<Dim>("liquidity");
  const [injDelta, setInjDelta] = useState(-0.05);
  const [corpusOpen, setCorpusOpen] = useState(false);
  const [corpusQ, setCorpusQ] = useState("");
  const poll = useRef<number | null>(null);
  const scenarioRef = useRef(scenario);
  scenarioRef.current = scenario;

  const refreshJobs = useCallback(() => { listJobs().then(rows => { setJobs(rows); setHistoryError(""); }).catch(e => setHistoryError(e instanceof Error ? e.message : "History unavailable")); }, []);
  useEffect(() => { refreshJobs(); }, [refreshJobs]);
  useEffect(() => () => { if (poll.current) window.clearInterval(poll.current); stopSpeaking(); }, []);
  useEffect(() => { localStorage.setItem("vv-handsfree", handsFree ? "1" : "0"); }, [handsFree]);
  useEffect(() => { localStorage.setItem("vv-speak", speakOn ? "1" : "0"); }, [speakOn]);

  const execute = useCallback(async (text: string, extra: { parent_job_id?: string; inject?: { dimension: string; delta: number } } = {}) => {
    if (busy) return;
    const trimmed = text.trim();
    if (trimmed.length < 8) { setError("Describe the scenario in at least a few words."); return; }
    setBusy(true); setError(""); setStage("queued"); setCountdown(null); stopSpeaking();
    const id = crypto.randomUUID();
    setJobId(id);
    poll.current = window.setInterval(async () => { const s = await jobStatus(id).catch(() => null); if (s) setStage(s); }, 1200);
    try {
      const prev = extra.parent_job_id ? result : null;
      const r = await runSimulation({ scenario: trimmed, job_id: id, ...extra });
      setParent(prev); setResult(r.result); setTab("forecast"); refreshJobs();
      if (speakOn && r.result.analysis?.spoken_summary) speak(r.result.analysis.spoken_summary);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
    } finally {
      if (poll.current) window.clearInterval(poll.current);
      setBusy(false); setStage("");
    }
  }, [result, refreshJobs, speakOn, busy]);

  // Hands-free: a clear voice transcript starts a 3-second visible countdown that can be cancelled.
  const voice = useVoiceInput({
    onFinal: (text, confidence) => {
      setScenario(text);
      if (handsFree && confidence >= 0.75) setCountdown(3);
    },
  });
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) { void execute(scenarioRef.current); return; }
    const t = window.setTimeout(() => setCountdown(c => (c === null ? null : c - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [countdown, execute]);

  const openJob = async (id: string) => {
    try {
      const r = await loadJob(id);
      if (r) { setResult(r); setJobId(id); setParent(null); setScenario(r.scenario); setTab("forecast"); }
    } catch (e) { setError(e instanceof Error ? e.message : "Could not open simulation"); }
  };
  const corpusRows = useMemo(() => (corpus as { event_id: string; name: string; start_date: string; category: string }[]).filter(e => (e.name + e.category).toLowerCase().includes(corpusQ.toLowerCase())), [corpusQ]);
  const stageIdx = STAGES.findIndex(([k]) => k === stage);

  return (
    <VVLayout status={{ label: busy ? "SIMULATING" : "RESEARCH", tone: busy ? "cyan" : "gold" }}>
      <div className="scroll-inner autosim-workspace">
      <div className="autosim-header"><h1>Scenario simulator</h1><Link to="/simulations/pilot">MiroFish pilot & research chat ↗</Link></div>
      <div className="sim-root">
        <aside className="sim-left">
          <section className="panel sim-card">
            <div className="panel-title">World state</div>
            <WorldState />
          </section>

          <section className="panel sim-card">
            <div className="panel-title">Scenario</div>
            <textarea className="sim-input" rows={4} value={scenario} maxLength={2000} placeholder="Describe what happens. Type it or tap the mic and say it." onChange={e => setScenario(e.target.value)} aria-label="Scenario" />
            {voice.listening && <p className="sim-note sim-live">Listening… {voice.interim}</p>}
            {countdown !== null && <p className="sim-note sim-live">Running in {countdown}… <Button variant="ghost" className="sim-link" onClick={() => setCountdown(null)}>Cancel</Button></p>}
            {voice.error && <p className="sim-note sim-warn">{voice.error}</p>}
            <div className="sim-row">
              <Button variant="ghost" className={`sim-mic${voice.listening ? " on" : ""}`} disabled={!voice.supported || busy} onClick={voice.listening ? voice.stop : voice.start} aria-label={voice.listening ? "Stop recording" : "Start voice input"} title={voice.supported ? "Tap to speak" : "Voice input isn't supported in this browser"}>{voice.listening ? <Square size={18} /> : <Mic size={18} />}</Button>
              <Button variant="ghost" className="sim-go" disabled={busy || scenario.trim().length < 8} onClick={() => execute(scenario)}>{busy ? "Simulating…" : "Simulate scenario"}</Button>
            </div>
            <label className="sim-check"><input type="checkbox" checked={handsFree} onChange={e => setHandsFree(e.target.checked)} /> Hands-free: run automatically after I speak</label>
            <label className="sim-check"><input type="checkbox" checked={speakOn} onChange={e => setSpeakOn(e.target.checked)} /> Read the summary aloud</label>
            {!scenario && <div className="sim-chips">{EXAMPLES.map(x => <Button variant="ghost" key={x} className="sim-chip-btn" onClick={() => setScenario(x)}>{x}</Button>)}</div>}
            {error && <p className="sim-note sim-warn" role="alert">{error}</p>}
          </section>

          {(busy || stageIdx >= 0) && (
            <section className="panel sim-card" aria-live="polite">
              <div className="panel-title">Automatic pipeline</div>
              <ol className="sim-stages">{STAGES.map(([k, t], i) => <li key={k} className={i < stageIdx ? "done" : i === stageIdx ? "run" : ""}>{t}</li>)}</ol>
            </section>
          )}

          <section className="panel sim-card">
            <div className="panel-title">Inject variable</div>
            <div className="sim-row">
              <select className="sim-select" value={injDim} onChange={e => setInjDim(e.target.value as Dim)} aria-label="Dimension">{DIMENSIONS.map(d => <option key={d} value={d}>{label(d)}</option>)}</select>
              <input type="range" min={-0.2} max={0.2} step={0.01} value={injDelta} onChange={e => setInjDelta(Number(e.target.value))} aria-label="Shock size" />
              <b className="sim-num">{injDelta > 0 ? "+" : ""}{injDelta.toFixed(2)}</b>
            </div>
            <Button variant="ghost" className="sim-ghost" disabled={busy || !result || !jobId} onClick={() => { if (result && jobId) void execute(result.scenario, { parent_job_id: jobId, inject: { dimension: injDim, delta: injDelta } }); }}>Re-run with this change</Button>
            <p className="sim-note">Creates a new run you can compare. The original stays frozen.</p>
          </section>

          <section className="panel sim-card">
            <Button variant="ghost" className="sim-link" onClick={() => setCorpusOpen(o => !o)} aria-expanded={corpusOpen}>Corpus · {(corpus as unknown[]).length} historical events {corpusOpen ? "▾" : "▸"}</Button>
            {corpusOpen && (<>
              <input className="sim-input" placeholder="Search events" value={corpusQ} onChange={e => setCorpusQ(e.target.value)} aria-label="Search corpus" />
              <ul className="sim-corpus">{corpusRows.map(e => <li key={e.event_id}><b>{e.start_date}</b> {e.name} <span className="sim-chip">{e.category}</span></li>)}</ul>
            </>)}
          </section>
        </aside>

        <main className="sim-right">
          <div className="sim-tabs" role="tablist">{TABS.map(t => <Button variant="ghost" key={t} role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{t}</Button>)}</div>
          <div className="panel sim-body">
            {result && result.warnings.length > 0 && <div className="sim-warnbox">{result.warnings.map((w, i) => <p key={i}>{w}</p>)}</div>}
            {tab === "canvas" && <DimensionCanvas result={result} />}
            {tab === "forecast" && <Forecast r={result} parent={parent} />}
            {tab === "strategies" && <Strategies r={result} />}
            {tab === "agents" && <Agents r={result} jobId={jobId} />}
            {tab === "history" && (
              <ul className="sim-history">
                {historyError && <li role="alert" className="sim-warn">{historyError}</li>}
                {!historyError && !jobs.length && <li className="sim-note">No simulations yet. Your runs appear here and can be reopened without changing them.</li>}
                {jobs.map(j => <li key={j.id}><Button variant="ghost" className="sim-link" onClick={() => openJob(j.id)} disabled={j.status !== "completed"}>{j.scenario.slice(0, 90)}</Button> <span className="sim-chip">{j.status}</span>{j.parent_job_id && <span className="sim-chip">variant</span>} <time>{new Date(j.created_at).toLocaleString()}</time></li>)}
              </ul>
            )}
            {result && <p className="sim-fine">{result.disclaimer} Engine {result.engine_version} · seed {result.seed} · model {result.model}</p>}
          </div>
        </main>
      </div>
      </div>
    </VVLayout>
  );
}

function Forecast({ r, parent }: { r: AutoSimResult | null; parent: AutoSimResult | null }) {
  if (!r) return <p className="sim-note">Run a scenario to see simulated ranges for each dimension, the news used, and the explanation.</p>;
  const a = r.analysis;
  return (
    <div>
      {a?.headline && <h2 className="sim-h">{a.headline}</h2>}
      {a?.summary && <p className="sim-p">{a.summary}</p>}
      <span className="tag tag-gold">{r.mode === "hypothetical" ? "Hypothetical scenario" : "Grounded in recent news"}</span> <span className="tag tag-grey">{r.calibration_status}</span>
      <h3 className="sim-h3">Where each dimension ends up in {r.horizon_days} days</h3>
      <div className="sim-ranges">
        {DIMENSIONS.map(d => { const x = r.dimensions.distribution[d]; const dp = parent ? x.p50 - parent.dimensions.distribution[d].p50 : null; return (
          <div key={d} className="sim-range">
            <span>{label(d)}{r.state.neutral_dimensions.includes(d) && <em title="No live data, neutral default"> *</em>}</span>
            <div className="sim-rail"><div className="sim-band" style={{ left: `${x.p5 * 100}%`, width: `${Math.max(1, (x.p95 - x.p5) * 100)}%` }} /><div className="sim-mark start" style={{ left: `${x.baseline * 100}%` }} title="Start" /><div className="sim-mark" style={{ left: `${x.p50 * 100}%` }} title="Median" /></div>
            <b>{x.p50.toFixed(2)}{dp !== null && <small className={dp > 0 ? "up" : "down"}> {dp > 0 ? "+" : ""}{dp.toFixed(2)} vs original</small>}</b>
          </div>); })}
      </div>
      <p className="sim-fine">Hollow marker = start, filled = median, band = 5th–95th percentile. * = neutral default (no live data).</p>
      {a?.drivers?.length ? <><h3 className="sim-h3">What drove it</h3><ul className="sim-list">{a.drivers.map((x, i) => <li key={i}>{x}</li>)}</ul></> : null}
      {a?.risks?.length ? <><h3 className="sim-h3">Risks</h3><ul className="sim-list">{a.risks.map((x, i) => <li key={i}>{x}</li>)}</ul></> : null}
      {a?.gaps?.length ? <><h3 className="sim-h3">Gaps and conflicts</h3><ul className="sim-list">{a.gaps.map((x, i) => <li key={i}>{x}</li>)}</ul></> : null}
      <h3 className="sim-h3">News used</h3>
      <p className="sim-note">{r.evidence.status === "found" ? `${r.evidence.selected.length} headlines from ${r.evidence.independent_sources} sources (of ${r.evidence.sources_reporting} reporting in the last ${r.evidence.window_hours}h).` : r.evidence.status === "none_found" ? "No matching headlines in the last 72 hours, so this ran as a hypothetical." : "The news index couldn't be queried for this run."}</p>
      <ul className="sim-news">{r.evidence.selected.map(h => <li key={h.url}><a href={h.url} target="_blank" rel="noreferrer noopener">{h.title}</a> <span className="sim-chip">{h.source} · {h.country}</span></li>)}</ul>
    </div>
  );
}

function Strategies({ r }: { r: AutoSimResult | null }) {
  if (!r) return <p className="sim-note">Fees, slippage and leverage are set automatically from the simulated conditions. Run a scenario to see all six strategies tested.</p>;
  const c = r.execution.cost, h = r.strategies.historical;
  return (
    <div>
      <p className="sim-p"><b>{r.market.asset}</b> · set automatically: leverage <b>{c.leverage}×</b>, fee {c.fee_bps} bps, slippage {c.slippage_bps} bps, spread {c.spread_bps} bps, funding {c.funding_bps_per_day} bps/day.</p>
      <ul className="sim-list">{r.execution.rationale.map((x, i) => <li key={i}>{x}</li>)}</ul>
      <h3 className="sim-h3">Scenario test · {r.horizon_days} days · simulated price paths</h3>
      <div className="sim-scroll"><table className="sim-table"><thead><tr><th>Strategy</th><th>Median</th><th>5th–95th</th><th>Chance of loss</th><th>Chance of liquidation</th><th>Median drawdown</th><th>Trades</th><th>{h ? "Last " + h.window.days + "d replay" : "Replay"}</th></tr></thead>
        <tbody>
          {r.strategies.scenario.map(s => { const hr = h?.strategies.find(x => x.id === s.id); return (
            <tr key={s.id}><td>{s.label}</td><td className={s.median_return >= 0 ? "up" : "down"}>{pct(s.median_return)}</td><td>{pct(s.p5_return, 0)} to {pct(s.p95_return, 0)}</td><td>{pct(s.prob_loss, 0)}</td><td>{pct(s.prob_liquidation, 0)}</td><td>{pct(s.median_max_drawdown, 0)}</td><td>{s.median_trades}</td><td>{hr?.available ? <span className={(hr.total_return ?? 0) >= 0 ? "up" : "down"}>{pct(hr.total_return)}{hr.liquidated ? " ⚠" : ""}</span> : <span title={hr?.reason}>n/a</span>}</td></tr>); })}
          <tr className="sim-bh"><td>Buy and hold</td><td>{pct(r.strategies.buy_hold_scenario.median_return)}</td><td>{pct(r.strategies.buy_hold_scenario.p5_return, 0)} to {pct(r.strategies.buy_hold_scenario.p95_return, 0)}</td><td colSpan={4}></td><td>{h ? pct(h.buy_hold.total_return) : "—"}</td></tr>
        </tbody></table></div>
      <p className="sim-fine">{h ? h.note : "No price history was available, so there is no replay."} Scenario results use uncalibrated coefficients; treat them as a stress test, not a forecast. Past replay does not predict future results.</p>
    </div>
  );
}

function Agents({ r, jobId }: { r: AutoSimResult | null; jobId: string | null }) {
  const [agent, setAgent] = useState<typeof AGENTS[number]>("investors");
  const [q, setQ] = useState("");
  const [ans, setAns] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!r) return <p className="sim-note">Seven simulated agent groups react to the scenario. Run one to inspect and question them.</p>;
  const ask = async () => { if (!jobId) return; setBusy(true); setErr(""); setAns(""); try { setAns((await interrogateAgent(jobId, agent, q)).answer); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } };
  return (
    <div>
      <div className="sim-agents">{AGENTS.map(g => (
        <Button variant="ghost" key={g} className={`sim-agent${agent === g ? " on" : ""}`} onClick={() => setAgent(g)}>
          <b>{label(g)}</b><span>response {r.agents[g].toFixed(3)}</span><small>{Object.keys(AGENT_RESPONSES[g]).map(label).join(" · ")}</small>
        </Button>))}</div>
      <div className="sim-row"><input className="sim-input" value={q} maxLength={400} onChange={e => setQ(e.target.value)} placeholder={`Ask the simulated ${label(agent)} group`} aria-label="Question" /><Button variant="ghost" className="sim-ghost" disabled={busy || !jobId || q.trim().length < 3} onClick={ask}>{busy ? "Asking…" : "Ask"}</Button></div>
      {err && <p className="sim-note sim-warn">{err}</p>}
      {ans && <blockquote className="sim-quote">{ans}</blockquote>}
      <p className="sim-fine">Answers come from the model's response weights and numbers. They are simulated, not statements by real institutions.</p>
    </div>
  );
}
