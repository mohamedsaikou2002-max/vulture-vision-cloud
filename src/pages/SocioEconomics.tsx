import { useEffect, useState } from "react";
import VVLayout from "@/components/VVLayout";
import {
  fetchSocioFull, fetchSocioHealth, SOCIO_DIMS, SocioFull, colorForDim,
} from "@/lib/socioApi";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const MC_COLORS = ["#ff2222", "#ff9d4d", "#00e5ff", "#00ff88"];

function stanceClass(stance: string) {
  if (stance === "BUY") return "se-stance-buy";
  if (stance === "SELL" || stance === "DE-RISK") return "se-stance-sell";
  return "se-stance-hold";
}

export default function SocioEconomics() {
  const [data, setData] = useState<SocioFull | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);
  const [err, setErr] = useState<{ kind: string; message: string; status?: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  async function loadAll() {
    setLoading(true);
    const r = await fetchSocioFull();
    setLastFetch(new Date());
    if (r.data) { setData(r.data); setErr(null); setOnline(true); }
    else { setErr(r.error || { kind: "offline", message: "Unknown error" }); setOnline(false); }
    setLoading(false);
  }

  useEffect(() => {
    let alive = true;
    async function ping() {
      const ok = await fetchSocioHealth();
      if (alive) setOnline(ok);
    }
    ping(); loadAll();
    const t1 = setInterval(ping, 15000);
    const t2 = setInterval(loadAll, 5 * 60 * 1000);
    return () => { alive = false; clearInterval(t1); clearInterval(t2); };
  }, []);

  const status = {
    label: online === null ? "CONNECTING" : online ? "SYSTEM ONLINE" : "BACKEND OFFLINE",
    tone: (online ? "green" : "red") as "green" | "red",
  };


  const signals = data?.signals || {};
  const confidence = data?.confidence || {};
  const overall = confidence.overall ?? 0;
  const blend = data?.simulation?.scenario_blend || [];
  const mc = data?.simulation?.monte_carlo || {};
  const probs = mc.probabilities || {};
  const agents = data?.agents || [];
  const events = data?.events_recent || [];
  const explanations = data?.explanations || {};
  const telemetry = data?.telemetry;
  const metadata = data?.metadata;

  const blendChart = blend.map(b => ({ name: b.scenario, weight: +(b.weight * 100).toFixed(1) }));
  const mcChart = [
    { name: "Crash",     value: +(((probs.crash    ?? 0) * 100).toFixed(1)) },
    { name: "Recession", value: +(((probs.recession ?? 0) * 100).toFixed(1)) },
    { name: "Recovery",  value: +(((probs.recovery ?? 0) * 100).toFixed(1)) },
    { name: "Boom",      value: +(((probs.boom     ?? 0) * 100).toFixed(1)) },
  ];

  return (
    <VVLayout status={status}>
      <div className="scroll-inner">

        {/* PRIMARY GAUGES */}
        <div className="se-stat-row">
          {["fear", "trust", "liquidity", "volatility"].map(dim => {
            const v = signals[dim] ?? 0.5;
            const col = colorForDim(dim, v);
            return (
              <div key={dim} className="se-gauge panel">
                <div className="se-gauge-label">{dim}</div>
                <div className="se-gauge-value" style={{ color: col }}>{v.toFixed(3)}</div>
                <div className="se-gauge-track">
                  <div className="se-gauge-fill" style={{ width: `${(v * 100).toFixed(1)}%`, background: col }} />
                </div>
                <div className="se-gauge-sub">confidence {((confidence[dim] ?? 0) * 100).toFixed(0)}%</div>
              </div>
            );
          })}
          <div className="se-gauge panel">
            <div className="se-gauge-label">Overall Confidence</div>
            <div className="se-gauge-value" style={{ color: overall > 0.6 ? "#00ff88" : overall > 0.35 ? "#f0c040" : "#ff9d4d" }}>
              {(overall * 100).toFixed(0)}%
            </div>
            <div className="se-gauge-track">
              <div className="se-gauge-fill" style={{ width: `${(overall * 100).toFixed(1)}%`, background: overall > 0.6 ? "#00ff88" : "#f0c040" }} />
            </div>
            <div className="se-gauge-sub">
              graph v{data?.graph_updates?.version ?? "—"} (prev v{data?.graph_updates?.prior_version ?? "—"})
            </div>
          </div>
        </div>

        {/* SECONDARY DIMENSIONS */}
        <div className="se-stat-row" style={{ gridTemplateColumns: "repeat(6,1fr)" }}>
          {["credit", "consumer", "inflation", "employment", "growth", "default"].map(dim => {
            const v = signals[dim] ?? 0.5;
            const col = colorForDim(dim, v);
            return (
              <div key={dim} className="se-gauge panel">
                <div className="se-gauge-label">{dim === "default" ? "Default Risk" : dim}</div>
                <div className="se-gauge-value" style={{ color: col }}>{v.toFixed(3)}</div>
                <div className="se-gauge-track">
                  <div className="se-gauge-fill" style={{ width: `${(v * 100).toFixed(1)}%`, background: col }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* SCENARIO BLEND */}
        <div className="panel" style={{ margin: "14px 24px 0" }}>
          <div className="panel-title">// DYNAMIC SCENARIO BLEND — weighted mix, not a single label</div>
          <div className="se-blend-wrap">
            {blend.length ? blend.map(b => (
              <div key={b.scenario} className="se-blend-row">
                <div className="se-blend-name">{b.scenario}</div>
                <div className="se-blend-track">
                  <div className="se-blend-fill" style={{ width: `${(b.weight * 100).toFixed(1)}%` }} />
                </div>
                <div className="se-blend-pct">{(b.weight * 100).toFixed(1)}%</div>
              </div>
            )) : <div className="q-loading">⬡ AWAITING PIPELINE OUTPUT...</div>}
          </div>
        </div>

        {/* MONTE CARLO */}
        <div className="panel" style={{ margin: "14px 24px 0" }}>
          <div className="panel-title">
            // MONTE CARLO — 30-DAY FORWARD SIMULATION · {mc.n_paths ?? "—"} PATHS · {mc.n_days ?? "—"}D
          </div>
          <div className="se-mc-grid">
            {[
              { key: "crash",     label: "Crash",     cls: "mc-crash",     val: probs.crash },
              { key: "recession", label: "Recession", cls: "mc-recession", val: probs.recession },
              { key: "recovery",  label: "Recovery",  cls: "mc-recovery",  val: probs.recovery },
              { key: "boom",      label: "Boom",      cls: "mc-boom",      val: probs.boom },
            ].map(c => (
              <div key={c.key} className={`se-mc-cell ${c.cls}`}>
                <div className="mc-label">{c.label}</div>
                <div className="mc-val">{c.val != null ? `${(c.val * 100).toFixed(1)}%` : "—"}</div>
              </div>
            ))}
          </div>
        </div>

        {/* CHARTS */}
        <div className="se-charts-grid">
          <div className="se-chart-panel panel">
            <div className="panel-title">// SCENARIO BLEND WEIGHTS</div>
            <div style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={blendChart} layout="vertical" margin={{ top: 8, right: 16, bottom: 8, left: 40 }}>
                  <XAxis type="number" tick={{ fill: "#8a7a55", fontSize: 10 }} tickFormatter={v => `${v}%`} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "#8a7a55", fontSize: 9 }} width={110} />
                  <Tooltip contentStyle={{ background: "#000", border: "1px solid #c9a84c", fontSize: 11 }} />
                  <Bar dataKey="weight" fill="#c9a84caa" stroke="#c9a84c" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="se-chart-panel panel">
            <div className="panel-title">// MONTE CARLO OUTCOME DISTRIBUTION</div>
            <div style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={mcChart} dataKey="value" nameKey="name" innerRadius={40} outerRadius={80} stroke="#000">
                    {mcChart.map((_, i) => <Cell key={i} fill={MC_COLORS[i]} />)}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 10, color: "#8a7a55" }} />
                  <Tooltip contentStyle={{ background: "#000", border: "1px solid #c9a84c", fontSize: 11 }} formatter={(v: number) => `${v}%`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* AGENT PANEL */}
        <div className="panel" style={{ margin: "14px 24px 0" }}>
          <div className="panel-title">// AGENT PANEL — beliefs, trust, stance · {agents.length} TYPES</div>
          <div style={{ overflowX: "auto" }}>
            <table className="se-table">
              <thead>
                <tr>
                  <th>AGENT TYPE</th><th>BELIEF (FEAR)</th><th>TRUST</th><th>RISK APPETITE</th><th>STANCE</th>
                </tr>
              </thead>
              <tbody>
                {agents.length ? agents.map((a, i) => (
                  <tr key={i}>
                    <td><strong>{a.type}</strong></td>
                    <td style={{ color: a.belief_fear > 0.6 ? "#ff2222" : a.belief_fear < 0.4 ? "#00ff88" : "#f0c040" }}>
                      {a.belief_fear.toFixed(3)}
                    </td>
                    <td>{a.trust.toFixed(3)}</td>
                    <td>{a.risk_appetite.toFixed(2)}</td>
                    <td className={stanceClass(a.stance)}>{a.stance}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={5} className="se-empty">
                    {online === false ? "Backend offline" : "Loading agent data..."}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* EVENT FEED */}
        <div className="panel" style={{ margin: "14px 24px 0" }}>
          <div className="panel-title">// EVENT TAXONOMY FEED — {events.length} EVENTS</div>
          <div style={{ overflowX: "auto" }}>
            <table className="se-table">
              <thead>
                <tr>
                  <th>TYPE</th><th>SEVERITY</th><th>CONFIDENCE</th><th>CONSENSUS</th><th>SOURCES</th><th>HEADLINE</th>
                </tr>
              </thead>
              <tbody>
                {events.length ? events.map((e, i) => (
                  <tr key={i}>
                    <td><span className="se-badge se-badge-gold">{(e.event_type || "").replace(/_/g, " ")}</span></td>
                    <td>{(+e.severity).toFixed(2)}</td>
                    <td>{(+e.confidence).toFixed(2)}</td>
                    <td>{(+e.consensus).toFixed(2)}</td>
                    <td><span className="se-badge se-badge-dim">{(e.sources || []).join(", ") || "—"}</span></td>
                    <td style={{ whiteSpace: "normal", maxWidth: 360 }}>{e.headline || ""}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={6} className="se-empty">
                    {online === false ? "Backend offline" : "No events ingested yet — waiting on next cycle"}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* EXPLAINABILITY */}
        <div className="panel se-narrative">
          <div className="narrative-header" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, paddingBottom: 10, borderBottom: "1px solid rgba(201,168,76,.10)" }}>
            <div className="status-dot" style={{
              background: data?.narrative ? "var(--green)" : "var(--dim)",
              boxShadow: data?.narrative ? "0 0 6px var(--green)" : "none",
            }} />
            <span className="panel-title" style={{ marginBottom: 0 }}>// EXPLAINABILITY — WHY THE STATE MOVED</span>
            <span style={{ fontSize: ".54rem", color: "var(--dim)", letterSpacing: ".10em", marginLeft: "auto" }}>
              {metadata?.timestamp ? new Date(metadata.timestamp).toLocaleTimeString() : ""}
            </span>
          </div>
          <div className="se-narrative-body">
            {data?.narrative ? data.narrative
              : online === false
                ? <span style={{ color: "var(--red)" }}>[BACKEND OFFLINE] Start socioeconomics_backend.py on port 5002</span>
                : <span className="dim-text">⬡ COMPUTING DETERMINISTIC RISK SCORES...</span>}
          </div>
          <div className="se-reasons-grid">
            {SOCIO_DIMS.map(dim => {
              const reasons = explanations[dim];
              if (!reasons?.length) return null;
              return (
                <div key={dim} className="se-reason-row">
                  <span className="se-reason-dim">{dim}</span>{reasons.join(" · ")}
                </div>
              );
            })}
          </div>
        </div>

        {/* TELEMETRY */}
        <div className="se-telemetry">
          {telemetry ? (
            <>
              <span>ARTICLES <b>{telemetry.articles_fetched ?? 0}</b></span>
              <span>CLUSTERS <b>{telemetry.clusters_found ?? 0}</b></span>
              <span>EVENTS INGESTED <b>{telemetry.events_ingested ?? 0}</b></span>
              <span>QUEUE <b>{telemetry.queue_length ?? 0}</b></span>
              <span>LLM CALLS <b>{telemetry.llm_calls ?? 0}</b></span>
              <span>LLM LATENCY <b>{telemetry.llm_latency_ms ?? 0}ms</b></span>
              <span>CYCLE <b>{telemetry.cycle_duration_ms ?? 0}ms</b></span>
              <span>LOOKBACK <b>{metadata?.lookback_hours ?? "—"}h</b></span>
              <span>SOURCES <b>{(metadata?.sources || []).length}</b></span>
              {telemetry.llm_error && <span style={{ color: "var(--red)" }}>LLM: {telemetry.llm_error}</span>}
            </>
          ) : <span>PIPELINE OFFLINE</span>}
        </div>

      </div>
    </VVLayout>
  );
}
