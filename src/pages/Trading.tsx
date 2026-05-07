import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import {
  LineChart, Line, XAxis, YAxis, ReferenceLine, ResponsiveContainer, Tooltip,
} from "recharts";
import VVLayout from "@/components/VVLayout";

const VV_HOST = (import.meta.env.VITE_VV_HOST as string) || "localhost:5000";
const WS_URL = `${location.protocol === "https:" ? "wss" : "ws"}://${VV_HOST}`;
const HTTP_URL = `${location.protocol === "https:" ? "https" : "http"}://${VV_HOST}`;

const EXCHANGES = ["binance", "bybit", "oanda", "alpaca"] as const;
type Exch = typeof EXCHANGES[number];

// ---------- types (loose; we render whatever the server sends) ----------
interface ConnState { state?: string; last_msg?: number; reconnects?: number }
interface Tick { instrument: string; bid?: number; ask?: number; price?: number; ts?: number }
interface LatencyMsg { [k: string]: number }
interface PortfolioMsg {
  value_usd: number;
  peak_value_usd?: number;
  kill_switch_active?: boolean;
  ts?: number;
  positions?: Record<string, any>;
  connection_state?: Record<string, ConnState>;
}
interface MirofishMsg {
  forced_action_signal?: string;
  coherence_score?: number;
  exfiltration_opportunity?: boolean;
  agent_stress?: Record<string, number>;
  verdict?: string;
  confidence?: number;
}
interface QuantumMsg { [instrument: string]: number }
interface SynthMsg {
  l3_quantum?: { top_allocations?: Array<{ instrument: string; weight: number; p_win: number }> };
  [k: string]: any;
}
interface NewsItem { id?: string; title: string; source?: string; ts?: number; url?: string }
interface RegimeMsg { regime: string; ts?: number; [k: string]: any }
interface HegelMsg { thesis?: string; antithesis?: string; synthesis?: string; ts?: number }

// ---------- helpers (pure presentation) ----------
const latencyColor = (ms?: number) =>
  ms == null ? "#666" : ms < 200 ? "#3df58a" : ms < 1000 ? "#f5c84a" : "#ff5560";

const lerpHex = (a: string, b: string, t: number) => {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255;
  const br = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `rgb(${r},${g},${bl})`;
};
const coherenceColor = (s: number) =>
  s < 0.3 ? lerpHex("#ff3b3b", "#f5c84a", s / 0.3) : lerpHex("#f5c84a", "#3df58a", (s - 0.3) / 0.7);

const LS_KEY = "vv-trading-prefs";
const loadPrefs = () => {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; }
};
const savePrefs = (p: any) => localStorage.setItem(LS_KEY, JSON.stringify(p));

export default function Trading() {
  // ---------- live state from sockets ----------
  const [connState, setConnState] = useState<Record<string, ConnState>>({});
  const [latency, setLatency] = useState<LatencyMsg>({});
  const [regime, setRegime] = useState<RegimeMsg | null>(null);
  const [mirofish, setMirofish] = useState<MirofishMsg | null>(null);
  const [quantum, setQuantum] = useState<QuantumMsg>({});
  const [hegel, setHegel] = useState<HegelMsg | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioMsg | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [synth, setSynth] = useState<SynthMsg | null>(null);
  const [ticks, setTicks] = useState<Record<string, Tick>>({});
  const [equityHist, setEquityHist] = useState<{ ts: number; value: number }[]>([]);
  const [socketConnected, setSocketConnected] = useState(false);
  const [lastConnSeen, setLastConnSeen] = useState<Record<string, number>>({});

  const tickBufRef = useRef<Record<string, Tick[]>>({});
  const socketRef = useRef<Socket | null>(null);

  const prefs = useRef<any>(loadPrefs());
  const [sortBy, setSortBy] = useState<string>(prefs.current.sortBy || "weight");
  const [filter, setFilter] = useState<string>(prefs.current.filter || "");
  useEffect(() => { savePrefs({ sortBy, filter }); }, [sortBy, filter]);

  // ---------- connect ----------
  useEffect(() => {
    // backfill equity history on mount
    fetch(`${HTTP_URL}/history`)
      .then(r => r.ok ? r.json() : [])
      .then((rows: any[]) => {
        if (Array.isArray(rows)) {
          setEquityHist(rows.map(r => ({ ts: r.ts ?? r.time ?? Date.now(), value: r.value_usd ?? r.value ?? 0 })));
        }
      })
      .catch(() => {});

    const s = io(WS_URL, { transports: ["websocket"], reconnection: true });
    socketRef.current = s;

    s.on("connect", () => setSocketConnected(true));
    s.on("disconnect", () => setSocketConnected(false));

    s.on("ticks", (msg: Tick | Tick[]) => {
      const arr = Array.isArray(msg) ? msg : [msg];
      setTicks(prev => {
        const next = { ...prev };
        for (const t of arr) {
          if (!t?.instrument) continue;
          next[t.instrument] = t;
          const buf = tickBufRef.current[t.instrument] || [];
          buf.push(t);
          if (buf.length > 600) buf.shift();
          tickBufRef.current[t.instrument] = buf;
        }
        return next;
      });
    });

    s.on("latency", (msg: LatencyMsg) => setLatency(msg || {}));
    s.on("regime", (msg: RegimeMsg) => setRegime(msg));
    s.on("mirofish", (msg: MirofishMsg) => setMirofish(msg));
    s.on("quantum", (msg: QuantumMsg) => setQuantum(msg || {}));
    s.on("hegelian", (msg: HegelMsg) => setHegel(msg));
    s.on("portfolio", (msg: PortfolioMsg) => {
      setPortfolio(msg);
      if (msg?.connection_state) {
        setConnState(msg.connection_state);
        const now = Date.now();
        const seen: Record<string, number> = {};
        for (const k of Object.keys(msg.connection_state)) seen[k] = now;
        setLastConnSeen(prev => ({ ...prev, ...seen }));
      }
      if (typeof msg?.value_usd === "number") {
        setEquityHist(prev => {
          const next = [...prev, { ts: msg.ts ?? Date.now(), value: msg.value_usd }];
          const cutoff = Date.now() - 60 * 60 * 1000;
          return next.filter(p => p.ts >= cutoff);
        });
      }
    });
    s.on("news", (msg: NewsItem | NewsItem[]) => {
      const arr = Array.isArray(msg) ? msg : [msg];
      setNews(prev => [...arr, ...prev].slice(0, 50));
    });
    s.on("synthesis", (msg: SynthMsg) => setSynth(msg));

    return () => { s.removeAllListeners(); s.disconnect(); };
  }, []);

  const reload = async () => {
    try {
      const r = await fetch(`${HTTP_URL}/synthesis`);
      if (r.ok) setSynth(await r.json());
    } catch {}
  };

  // ---------- derived presentation ----------
  const exchPill = (ex: Exch) => {
    const cs = connState[ex];
    const seen = lastConnSeen[ex];
    let color = "#555";
    let label = "NO KEY";
    if (cs) {
      const state = cs.state;
      if (state === "connected") { color = "#3df58a"; label = "LIVE"; }
      else if (state === "reconnecting" || state === "connecting") { color = "#f5c84a"; label = state.toUpperCase(); }
      else { color = "#ff5560"; label = (state || "DOWN").toUpperCase(); }
    }
    if (seen && Date.now() - seen > 30_000 && cs?.state !== "connected") {
      color = "#ff5560"; label = "STALE";
    }
    const ageS = cs?.last_msg ? Math.max(0, Math.floor((Date.now() - cs.last_msg) / 1000)) : null;
    const tooltip = cs
      ? `${ex} · last_msg ${ageS ?? "?"}s ago · reconnects ${cs.reconnects ?? 0}`
      : `${ex} · no key configured`;
    return (
      <div key={ex} title={tooltip} className="vv-pill" style={{ borderColor: color, color }}>
        <span className="vv-dot" style={{ background: color }} />
        {ex.toUpperCase()} · {label}
      </div>
    );
  };

  const latReadout = (label: string, key: string) => {
    const v = latency[key];
    return (
      <div className="vv-lat" key={key}>
        <span className="vv-lat-label">{label}</span>
        <span className="vv-lat-val" style={{ color: latencyColor(v) }}>
          {v != null ? `${Math.round(v)} ms` : "— ms"}
        </span>
      </div>
    );
  };

  // quantum heatmap layout (squarified-ish: simple weight rows)
  const quantumEntries = Object.entries(quantum)
    .filter(([k]) => !filter || k.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => sortBy === "name" ? a[0].localeCompare(b[0]) : b[1] - a[1]);
  const totalWeight = quantumEntries.reduce((s, [, w]) => s + w, 0) || 1;
  const pWinFor = (inst: string) => {
    const top = synth?.l3_quantum?.top_allocations?.find(a => a.instrument === inst);
    return top?.p_win ?? 0.5;
  };

  // coherence gauge
  const coherence = mirofish?.coherence_score ?? 0;
  const cArc = Math.PI * 2 * coherence;
  const cColor = coherenceColor(coherence);

  // agent stress bars
  const agentKeys = ["institutional_mpt", "retail_momentum", "hft_arbitrage", "crypto_native", "macro_discretionary"];

  return (
    <VVLayout
      status={{
        label: socketConnected ? "LIVE FEED" : "DISCONNECTED",
        tone: socketConnected ? "green" : "red",
      }}
    >
      <style>{`
        .vv-grid { display: grid; gap: 12px; padding: 12px 16px 80px; max-width: 1600px; margin: 0 auto; }
        .vv-strip { display: flex; gap: 8px; align-items: center; height: 32px; flex-wrap: wrap; }
        .vv-pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border: 1px solid; border-radius: 999px; font-size: 11px; font-family: monospace; letter-spacing: .5px; background: rgba(0,0,0,.4); }
        .vv-dot { width: 6px; height: 6px; border-radius: 50%; }
        .vv-lat { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; font-family: monospace; font-size: 11px; border: 1px solid rgba(255,255,255,.1); border-radius: 4px; background: rgba(0,0,0,.4); }
        .vv-lat-label { color: rgba(255,255,255,.55); }
        .vv-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .vv-row3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
        .vv-panel { background: rgba(8,12,18,.7); border: 1px solid rgba(255,255,255,.08); border-radius: 6px; padding: 14px; backdrop-filter: blur(6px); }
        .vv-panel h3 { font-size: 11px; letter-spacing: 2px; color: rgba(255,255,255,.55); margin: 0 0 10px; font-family: monospace; }
        .vv-equity { height: 280px; }
        .vv-halt { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(255,40,40,.18); color: #ff5560; font-family: monospace; font-size: 28px; letter-spacing: 6px; border: 2px solid #ff5560; }
        .vv-heat { display: flex; flex-wrap: wrap; gap: 4px; min-height: 220px; align-content: flex-start; }
        .vv-heat-cell { padding: 8px; font-family: monospace; font-size: 11px; color: #000; border-radius: 3px; min-width: 60px; }
        .vv-bars { display: flex; flex-direction: column; gap: 6px; }
        .vv-bar-row { display: grid; grid-template-columns: 140px 1fr 40px; gap: 8px; align-items: center; font-family: monospace; font-size: 11px; }
        .vv-bar-track { height: 8px; background: rgba(255,255,255,.05); border-radius: 2px; overflow: hidden; }
        .vv-bar-fill { height: 100%; background: linear-gradient(90deg, #3df58a, #f5c84a); }
        .vv-pulse { animation: vvpulse 1.2s ease-in-out infinite; }
        @keyframes vvpulse { 0%,100%{ box-shadow: 0 0 0 0 rgba(255,60,60,.6);} 50%{ box-shadow: 0 0 24px 4px rgba(255,60,60,.6);} }
        .vv-news { max-height: 220px; overflow: auto; font-family: monospace; font-size: 11px; }
        .vv-news-item { padding: 6px 0; border-bottom: 1px dashed rgba(255,255,255,.08); }
        .vv-reload { position: fixed; right: 16px; bottom: 16px; padding: 8px 14px; background: rgba(0,0,0,.7); border: 1px solid rgba(255,255,255,.2); color: #fff; font-family: monospace; font-size: 11px; cursor: pointer; border-radius: 4px; letter-spacing: 2px; }
        .vv-reload:hover { background: rgba(61,245,138,.15); border-color: #3df58a; color: #3df58a; }
        .vv-input { background: rgba(0,0,0,.4); border: 1px solid rgba(255,255,255,.1); color: #fff; padding: 4px 8px; font-family: monospace; font-size: 11px; border-radius: 3px; }
        .vv-headline { font-family: monospace; font-size: 22px; letter-spacing: 2px; color: #f5c84a; margin: 4px 0 12px; }
      `}</style>

      <div className="vv-grid">
        {/* API status + latency strips */}
        <div className="vv-strip">
          {EXCHANGES.map(exchPill)}
          <div style={{ width: 16 }} />
          {latReadout("tick(binance)", "tick.binance")}
          {latReadout("tick(bybit)", "tick.bybit")}
          {latReadout("tick(oanda)", "tick.oanda")}
          {latReadout("tick(alpaca)", "tick.alpaca")}
          {latReadout("qaoa", "qaoa")}
          {latReadout("mirofish", "mirofish")}
        </div>

        {/* Equity curve */}
        <div className="vv-panel" style={{ position: "relative" }}>
          <h3>EQUITY CURVE · LAST 60 MIN</h3>
          <div className="vv-equity">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={equityHist}>
                <XAxis dataKey="ts" tickFormatter={t => new Date(t).toLocaleTimeString().slice(0, 5)} stroke="rgba(255,255,255,.4)" fontSize={10} />
                <YAxis domain={["auto", "auto"]} stroke="rgba(255,255,255,.4)" fontSize={10} tickFormatter={v => `$${(v / 1000).toFixed(1)}k`} />
                <Tooltip contentStyle={{ background: "#0a0e14", border: "1px solid rgba(255,255,255,.1)", fontSize: 11 }} labelFormatter={t => new Date(t as number).toLocaleTimeString()} formatter={(v: any) => [`$${Number(v).toLocaleString()}`, "value"]} />
                <Line type="monotone" dataKey="value" stroke="#3df58a" dot={false} strokeWidth={2} isAnimationActive={false} />
                {portfolio?.peak_value_usd != null && (
                  <ReferenceLine y={portfolio.peak_value_usd} stroke="#f5c84a" strokeDasharray="4 4" label={{ value: `peak $${portfolio.peak_value_usd.toLocaleString()}`, fill: "#f5c84a", fontSize: 10, position: "right" }} />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
          {portfolio?.kill_switch_active && <div className="vv-halt">⛔ HALTED ⛔</div>}
          <div style={{ marginTop: 8, fontFamily: "monospace", fontSize: 11, color: "rgba(255,255,255,.6)" }}>
            value: <span style={{ color: "#3df58a" }}>${portfolio?.value_usd?.toLocaleString() ?? "—"}</span>
            {portfolio?.peak_value_usd != null && <> · peak: ${portfolio.peak_value_usd.toLocaleString()}</>}
            {regime && <> · regime: <span style={{ color: "#f5c84a" }}>{regime.regime}</span></>}
          </div>
        </div>

        <div className="vv-row">
          {/* Coherence gauge */}
          <div className="vv-panel">
            <h3>COHERENCE</h3>
            <div style={{ display: "flex", justifyContent: "center", padding: "10px 0" }}>
              <svg width="200" height="200" viewBox="0 0 200 200">
                <circle cx="100" cy="100" r="80" stroke="rgba(255,255,255,.08)" strokeWidth="14" fill="none" />
                <circle
                  cx="100" cy="100" r="80"
                  stroke={cColor} strokeWidth="14" fill="none"
                  strokeDasharray={`${cArc * 80 / Math.PI} ${1000}`}
                  strokeLinecap="round"
                  transform="rotate(-90 100 100)"
                  style={{ transition: "stroke-dasharray .6s, stroke .6s" }}
                />
                <text x="100" y="100" textAnchor="middle" dy="6" fontFamily="monospace" fontSize="32" fill={cColor}>
                  {(coherence * 100).toFixed(0)}
                </text>
                <text x="100" y="130" textAnchor="middle" fontFamily="monospace" fontSize="10" fill="rgba(255,255,255,.5)">
                  COHERENCE
                </text>
              </svg>
            </div>
          </div>

          {/* MiroFish verdict */}
          <div
            className={`vv-panel ${mirofish?.exfiltration_opportunity ? "vv-pulse" : ""}`}
            style={mirofish?.exfiltration_opportunity ? { borderColor: "#ff3b3b" } : undefined}
          >
            <h3>MIROFISH VERDICT</h3>
            <div className="vv-headline">{mirofish?.forced_action_signal || mirofish?.verdict || "—"}</div>
            <div className="vv-bars">
              {agentKeys.map(k => {
                const v = mirofish?.agent_stress?.[k] ?? 0;
                return (
                  <div className="vv-bar-row" key={k}>
                    <span style={{ color: "rgba(255,255,255,.6)" }}>{k}</span>
                    <div className="vv-bar-track"><div className="vv-bar-fill" style={{ width: `${Math.min(100, v * 100)}%` }} /></div>
                    <span style={{ textAlign: "right", color: "#f5c84a" }}>{(v * 100).toFixed(0)}</span>
                  </div>
                );
              })}
            </div>
            {mirofish?.exfiltration_opportunity && (
              <div style={{ marginTop: 10, color: "#ff5560", fontFamily: "monospace", fontSize: 11, letterSpacing: 2 }}>
                ⚠ EXFILTRATION OPPORTUNITY
              </div>
            )}
          </div>
        </div>

        {/* Quantum allocation heatmap */}
        <div className="vv-panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>QUANTUM ALLOCATION</h3>
            <div style={{ display: "flex", gap: 6 }}>
              <input className="vv-input" placeholder="filter" value={filter} onChange={e => setFilter(e.target.value)} />
              <select className="vv-input" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                <option value="weight">sort: weight</option>
                <option value="name">sort: name</option>
              </select>
            </div>
          </div>
          <div className="vv-heat">
            {quantumEntries.length === 0 && <div style={{ color: "rgba(255,255,255,.4)", fontFamily: "monospace", fontSize: 11 }}>awaiting quantum channel…</div>}
            {quantumEntries.map(([inst, w]) => {
              const pct = w / totalWeight;
              const p = pWinFor(inst);
              const hue = Math.round(p * 130); // red→green
              return (
                <div
                  key={inst}
                  className="vv-heat-cell"
                  title={`${inst} · weight ${(pct * 100).toFixed(1)}% · p_win ${p.toFixed(2)}`}
                  style={{
                    background: `hsl(${hue} 70% 55%)`,
                    flexBasis: `${Math.max(60, pct * 800)}px`,
                    flexGrow: pct,
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{inst}</div>
                  <div>{(pct * 100).toFixed(1)}%</div>
                  <div style={{ opacity: .7 }}>p {p.toFixed(2)}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="vv-row3">
          {/* Live ticks */}
          <div className="vv-panel">
            <h3>LIVE TICKS</h3>
            <div style={{ fontFamily: "monospace", fontSize: 11, maxHeight: 220, overflow: "auto" }}>
              {Object.values(ticks).length === 0 && <span style={{ color: "rgba(255,255,255,.4)" }}>awaiting ticks…</span>}
              {Object.values(ticks).map(t => (
                <div key={t.instrument} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px dashed rgba(255,255,255,.06)" }}>
                  <span>{t.instrument}</span>
                  <span style={{ color: "#3df58a" }}>{t.price ?? t.bid ?? "—"}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Hegelian */}
          <div className="vv-panel">
            <h3>HEGELIAN SYNTHESIS</h3>
            <div style={{ fontFamily: "monospace", fontSize: 11, color: "rgba(255,255,255,.7)" }}>
              <div><span style={{ color: "#3df58a" }}>thesis:</span> {hegel?.thesis || "—"}</div>
              <div style={{ marginTop: 4 }}><span style={{ color: "#ff5560" }}>antithesis:</span> {hegel?.antithesis || "—"}</div>
              <div style={{ marginTop: 4 }}><span style={{ color: "#f5c84a" }}>synthesis:</span> {hegel?.synthesis || "—"}</div>
            </div>
          </div>

          {/* News */}
          <div className="vv-panel">
            <h3>NEWS</h3>
            <div className="vv-news">
              {news.length === 0 && <span style={{ color: "rgba(255,255,255,.4)" }}>awaiting news…</span>}
              {news.map((n, i) => (
                <div key={n.id || i} className="vv-news-item">
                  <div style={{ color: "#fff" }}>{n.title}</div>
                  <div style={{ color: "rgba(255,255,255,.5)", fontSize: 10 }}>{n.source || ""}{n.ts ? ` · ${new Date(n.ts).toLocaleTimeString()}` : ""}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Synthesis raw dump */}
        <div className="vv-panel">
          <h3>SYNTHESIS</h3>
          <pre style={{ margin: 0, fontFamily: "monospace", fontSize: 10, color: "rgba(255,255,255,.55)", maxHeight: 220, overflow: "auto" }}>
            {synth ? JSON.stringify(synth, null, 2) : "awaiting synthesis…"}
          </pre>
        </div>
      </div>

      <button className="vv-reload" onClick={reload}>↻ RELOAD</button>
    </VVLayout>
  );
}
