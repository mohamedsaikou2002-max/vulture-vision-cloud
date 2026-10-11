import { useCallback, useEffect, useRef, useState } from "react";
import VVLayout from "@/components/VVLayout";
import {
  runSimulation, fetchSimulation, fetchMirofishHealth, mirofishBaseUrl,
  type SimResult, type SimRound,
} from "@/lib/mirofishApi";

const PRESETS = [
  "Fed emergency rate cut — market contagion",
  "US-China tariff escalation — supply chain shock",
  "Stablecoin depeg event — crypto liquidity crisis",
  "Oil supply disruption — energy price spiral",
];

const ARCHETYPES = ["INSTITUTIONAL", "RETAIL", "WHALE", "MARKET MAKER", "HEDGER", "SPECULATOR"];

interface RoundRow extends SimRound { key: number }

export default function Simulations() {
  const [scenario, setScenario] = useState(PRESETS[0]);
  const [agents, setAgents] = useState(50);
  const [rounds, setRounds] = useState(12);
  const [running, setRunning] = useState(false);
  const [engineUp, setEngineUp] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SimResult | null>(null);
  const [liveRounds, setLiveRounds] = useState<RoundRow[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchMirofishHealth().then(setEngineUp);
    return () => { stopPoll(); stopTimer(); };
  }, []);

  const stopPoll = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  const stopTimer = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };

  const startTimer = () => {
    stopTimer(); setElapsed(0);
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
  };

  const launch = useCallback(async () => {
    setRunning(true); setError(null); setResult(null); setLiveRounds([]);
    startTimer();
    const res = await runSimulation({ scenario, agents, rounds });
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
    // Poll for round-by-round progress
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
  }, [scenario, agents, rounds]);

  const abort = () => { stopPoll(); stopTimer(); setRunning(false); };

  const sentimentColor = (v: number) => v > 0.15 ? "#00ff88" : v < -0.15 ? "#ff2222" : "#f0c040";
  const pct = (v: number) => `${Math.round(v * 100)}%`;

  return (
    <VVLayout status={{ label: engineUp === false ? "ENGINE OFFLINE" : running ? "SIM RUNNING" : "SYSTEM ONLINE", tone: engineUp === false ? "red" : running ? "gold" : "green" }}>
      <div className="vv-page">
        <header className="vv-header">
          <h1 className="vv-title">SIMULATIONS</h1>
          <div className="vv-subtitle">MIROFISH MULTI-AGENT SWARM ENGINE</div>
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
            <label className="sim-label">SCENARIO SEED</label>
            <textarea
              className="sim-textarea"
              rows={3}
              value={scenario}
              onChange={e => setScenario(e.target.value)}
              disabled={running}
            />
            <div className="sim-presets">
              {PRESETS.map(p => (
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

          {/* STATUS / VERDICT PANEL */}
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
                <div className="vv-panel-title">AGENT SWARM</div>
                {ARCHETYPES.map(a => {
                  const group = result.agents!.filter(x => x.archetype === a);
                  if (!group.length) return null;
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
          {result?.elapsed_ms ? ` · LAST RUN ${(result.elapsed_ms / 1000).toFixed(1)}s` : ""}
        </footer>
      </div>
    </VVLayout>
  );
}
