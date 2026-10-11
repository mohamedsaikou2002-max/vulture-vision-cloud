import { useCallback, useEffect, useRef, useState } from "react";
import VVLayout from "@/components/VVLayout";
import {
  runSimulation, fetchSimulation, fetchMirofishHealth, mirofishBaseUrl,
  type SimResult, type SimRound,
} from "@/lib/mirofishApi";
import { fetchSocioFull, type SocioFull } from "@/lib/socioApi";

const FALLBACK_PRESETS = [
  "Fed emergency rate cut — market contagion",
  "US-China tariff escalation — supply chain shock",
  "Stablecoin depeg event — crypto liquidity crisis",
  "Oil supply disruption — energy price spiral",
];

interface RoundRow extends SimRound { key: number }

export default function Simulations() {
  const [scenario, setScenario] = useState(FALLBACK_PRESETS[0]);
  const [agents, setAgents] = useState(50);
  const [rounds, setRounds] = useState(12);
  const [running, setRunning] = useState(false);
  const [engineUp, setEngineUp] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SimResult | null>(null);
  const [liveRounds, setLiveRounds] = useState<RoundRow[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [corpus, setCorpus] = useState<SocioFull | null>(null);
  const [corpusErr, setCorpusErr] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadCorpus = useCallback(async () => {
    const res = await fetchSocioFull();
    if (res.data) { setCorpus(res.data); setCorpusErr(null); }
    else setCorpusErr(res.error?.message || "Corpus unavailable");
  }, []);

  useEffect(() => {
    fetchMirofishHealth().then(setEngineUp);
    loadCorpus();
    return () => { stopPoll(); stopTimer(); };
  }, [loadCorpus]);

  const stopPoll = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  const stopTimer = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };

  const startTimer = () => {
    stopTimer(); setElapsed(0);
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
  };

  const launch = useCallback(async () => {
    setRunning(true); setError(null); setResult(null); setLiveRounds([]);
    startTimer();
    const res = await runSimulation({
      scenario, agents, rounds,
      corpus: corpus ? {
        signals: corpus.signals,
        confidence: corpus.confidence,
        scenario_blend: corpus.simulation?.scenario_blend,
        events: corpus.events_recent,
        agents: corpus.agents,
      } : undefined,
    } as any);
    if (res.error || !res.data) {
      setError(res.error?.message || "No response from engine");
      setRunning(false); stopTimer();
      setEngineUp(false);
      return;
    }
    setEngineUp(true);
    const sim = res.data;
    setResult(sim);
    if (sim.status === "complete" || sim.status === "failed") {
      setLiveRounds((sim.rounds || []).map((r, i) => ({ ...r, key: i })));
      setRunning(false); stopTimer();
      return;
    }
    pollRef.current = setInterval(async () => {
      const p = await fetchSimulation(sim.sim_id);
      if (p.data) {
        setResult(p.data);
        setLiveRounds((p.data.rounds || []).map((r, i) => ({ ...r, key: i })));
        if (p.data.status === "complete" || p.data.status === "failed") {
          stopPoll(); stopTimer(); setRunning(false);
        }
      }
    }, 2000);
  }, [scenario, agents, rounds, corpus]);

  const abort = () => { stopPoll(); stopTimer(); setRunning(false); };

  const sentimentColor = (v: number) => v > 0.15 ? "#00ff88" : v < -0.15 ? "#ff2222" : "#f0c040";
  const pct = (v: number) => `${Math.round(v * 100)}%`;

  // Corpus-derived presets: recent event headlines first, then fallbacks
  const corpusPresets = (corpus?.events_recent || []).map(e => e.headline).filter(Boolean).slice(0, 6);
  const presets = corpusPresets.length ? corpusPresets : FALLBACK_PRESETS;
  const blend = corpus?.simulation?.scenario_blend || [];
  const corpusAgents = corpus?.agents || [];
  const archetypes = [...new Set(corpusAgents.map(a => a.type))];

  return (
    <VVLayout status={{ label: engineUp === false ? "ENGINE OFFLINE" : running ? "SIM RUNNING" : "SYSTEM ONLINE", tone: engineUp === false ? "red" : running ? "gold" : "green" }}>
      <div className="vv-page">
        <header className="vv-header">
          <h1 className="vv-title">SIMULATIONS</h1>
          <div className="vv-subtitle">MIROFISH SWARM × SOCIO-ECONOMIC CORPUS</div>
        </header>

        {engineUp === false && (
          <div className="sim-banner">
            <span className="sim-banner-icon">⚠</span>
            <div>
              <div className="sim-banner-title">MIROFISH ENGINE OFFLINE</div>
              <div className="sim-banner-body">
                No response from <code>{mirofishBaseUrl()}</code>. Start the MiroFish engine and set
                <code> VITE_MIROFISH_HOST</code> if it runs elsewhere, then retry.
              </div>
            </div>
            <button className="sim-btn" onClick={() => fetchMirofishHealth().then(setEngineUp)}>↻ RETRY</button>
          </div>
        )}

        <div className="sim-grid">
          {/* CONFIG PANEL */}
          <section className="vv-panel sim-config">
            <div className="vv-panel-title">SIMULATION CONFIG</div>
            <label className="sim-label">SCENARIO SEED {corpusPresets.length > 0 && <span className="sim-corpus-tag">FROM CORPUS</span>}</label>
            <textarea
              className="sim-textarea"
              rows={3}
              value={scenario}
              onChange={e => setScenario(e.target.value)}
              disabled={running}
            />
            <div className="sim-presets">
              {presets.map(p => (
                <button key={p} className="sim-preset" onClick={() => setScenario(p)} disabled={running}>{p}</button>
              ))}
            </div>
            <div className="sim-row">
              <div>
                <label className="sim-label">AGENTS — {agents}</label>
                <input type="range" min={10} max={500} step={10} value={agents}
                  onChange={e => setAgents(+e.target.value)} disabled={running} className="sim-slider" />
              </div>
              <div>
                <label className="sim-label">ROUNDS — {rounds}</label>
                <input type="range" min={4} max={48} step={2} value={rounds}
                  onChange={e => setRounds(+e.target.value)} disabled={running} className="sim-slider" />
              </div>
            </div>
            <div className="sim-actions">
              {!running
                ? <button className="sim-btn sim-btn-go" onClick={launch} disabled={!scenario.trim()}>▶ RUN SIMULATION</button>
                : <button className="sim-btn sim-btn-stop" onClick={abort}>■ ABORT</button>}
              {running && <span className="sim-elapsed">{elapsed}s ELAPSED</span>}
            </div>
            {error && <div className="sim-error">ERROR: {error}</div>}
          </section>

          {/* CORPUS CONTEXT PANEL */}
          <section className="vv-panel sim-corpus">
            <div className="vv-panel-title">SOCIO-ECONOMIC CORPUS {corpusErr && <span className="sim-corpus-tag sim-corpus-off">OFFLINE</span>}</div>
            {corpusErr ? (
              <div className="sim-placeholder">
                Corpus unavailable — {corpusErr}.{" "}
                <button className="sim-btn" onClick={loadCorpus}>↻ RETRY</button>
              </div>
            ) : corpus ? (
              <>
                {blend.length > 0 && (
                  <>
                    <div className="sim-label">SCENARIO BLEND</div>
                    {blend.map(b => (
                      <div key={b.scenario} className="sim-archetype-row">
                        <span className="sim-archetype-name">{b.scenario.toUpperCase()}</span>
                        <div className="sim-bar"><div className="sim-bar-fill" style={{ width: pct(b.weight) }} /></div>
                        <span className="sim-archetype-conf">{pct(b.weight)}</span>
                      </div>
                    ))}
                  </>
                )}
                {archetypes.length > 0 && (
                  <>
                    <div className="sim-label" style={{ marginTop: 10 }}>CORPUS AGENTS</div>
                    {archetypes.map(a => {
                      const group = corpusAgents.filter(x => x.type === a);
                      const avg = group.reduce((s, x) => s + (x.trust ?? 0), 0) / group.length;
                      return (
                        <div key={a} className="sim-archetype-row">
                          <span className="sim-archetype-name">{a}</span>
                          <span className="sim-archetype-count">{group.length}</span>
                          <div className="sim-bar"><div className="sim-bar-fill" style={{ width: pct(avg) }} /></div>
                          <span className="sim-archetype-conf">{pct(avg)}</span>
                        </div>
                      );
                    })}
                  </>
                )}
                <div className="sim-label" style={{ marginTop: 10 }}>SIGNAL SNAPSHOT</div>
                <div className="sim-signal-grid">
                  {Object.entries(corpus.signals || {}).slice(0, 10).map(([k, v]) => (
                    <div key={k} className="sim-signal-cell">
                      <span className="sim-signal-key">{k.toUpperCase()}</span>
                      <span className="sim-signal-val">{typeof v === "number" ? v.toFixed(2) : String(v)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="sim-placeholder">LOADING CORPUS…</div>
            )}
          </section>

          {/* VERDICT PANEL */}
          <section className="vv-panel sim-verdict">
            <div className="vv-panel-title">EMERGENT VERDICT</div>
            {result?.verdict ? (
              <>
                <div className="sim-verdict-text">{result.verdict}</div>
                {result.emergent_signals && result.emergent_signals.length > 0 && (
                  <div className="sim-signals">
                    {result.emergent_signals.map((s, i) => <div key={i} className="sim-signal">◆ {s}</div>)}
                  </div>
                )}
              </>
            ) : (
              <div className="sim-placeholder">
                {running ? "SWARM CONVERGING…" : "RUN A SIMULATION TO GENERATE AN EMERGENT VERDICT"}
              </div>
            )}
            {result?.agents && result.agents.length > 0 && (
              <div className="sim-archetypes">
                <div className="vv-panel-title">SIM AGENT SWARM</div>
                {[...new Set(result.agents.map(x => x.archetype))].map(a => {
                  const group = result.agents!.filter(x => x.archetype === a);
                  const avg = group.reduce((s, x) => s + x.confidence, 0) / group.length;
                  return (
                    <div key={a} className="sim-archetype-row">
                      <span className="sim-archetype-name">{a}</span>
                      <span className="sim-archetype-count">{group.length}</span>
                      <div className="sim-bar"><div className="sim-bar-fill" style={{ width: pct(avg) }} /></div>
                      <span className="sim-archetype-conf">{pct(avg)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* ROUND TIMELINE */}
        <section className="vv-panel sim-timeline">
          <div className="vv-panel-title">ROUND-BY-ROUND TIMELINE {liveRounds.length > 0 && `— ${liveRounds.length}/${rounds}`}</div>
          {liveRounds.length === 0 ? (
            <div className="sim-placeholder">{running ? "AWAITING FIRST ROUND…" : "NO ROUNDS YET"}</div>
          ) : (
            <table className="sim-table">
              <thead>
                <tr><th>RND</th><th>SUMMARY</th><th>SENTIMENT</th><th>CONSENSUS</th><th>VOLATILITY</th><th>TOP NARRATIVES</th></tr>
              </thead>
              <tbody>
                {liveRounds.map(r => (
                  <tr key={r.key}>
                    <td className="sim-num">{r.round}</td>
                    <td className="sim-summary">{r.summary}</td>
                    <td style={{ color: sentimentColor(r.sentiment) }}>{r.sentiment > 0 ? "+" : ""}{r.sentiment.toFixed(2)}</td>
                    <td>{pct(r.consensus)}</td>
                    <td style={{ color: r.volatility > 0.6 ? "#ff2222" : r.volatility > 0.35 ? "#ff9d4d" : "#00ff88" }}>{pct(r.volatility)}</td>
                    <td className="sim-narratives">{(r.top_narratives || []).join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <footer className="sim-footer">
          ENGINE: {mirofishBaseUrl()} · STATUS: {engineUp === null ? "CHECKING…" : engineUp ? "CONNECTED" : "OFFLINE"}
          {corpus ? " · CORPUS: LOADED" : " · CORPUS: UNAVAILABLE"}
          {result?.elapsed_ms ? ` · LAST RUN ${(result.elapsed_ms / 1000).toFixed(1)}s` : ""}
        </footer>
      </div>
    </VVLayout>
  );
}
