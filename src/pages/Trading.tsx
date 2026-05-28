import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import {
  LineChart, Line, XAxis, YAxis, ReferenceLine, ResponsiveContainer, Tooltip,
} from "recharts";
import { NavLink } from "react-router-dom";
import {
  fetchLatestBrief, fetchRegime, subscribeToIntelBriefs,
  IntelBrief, RegimeState, REGIME_COLORS, REGIME_LABELS, dirArrow, dirClass,
} from "@/lib/intelApi";

const VV_HOST = (import.meta.env.VITE_VV_HOST as string) || "localhost:5000";
const WS_URL = `${location.protocol === "https:" ? "wss" : "ws"}://${VV_HOST}`;
const HTTP_URL = `${location.protocol === "https:" ? "https" : "http"}://${VV_HOST}`;

const EXCHANGES = ["binance", "bybit", "oanda", "alpaca"] as const;
type Exch = typeof EXCHANGES[number];

const MIN_COHERENCE = 0.30;

interface ConnState { state?: string; last_msg?: number; reconnects?: number }
interface Tick { instrument: string; bid?: number; ask?: number; price?: number; ts?: number; change_24h_pct?: number; volume?: number }
interface LatencyMsg { [k: string]: number }
interface PortfolioMsg {
  value_usd: number;
  peak_value_usd?: number;
  kill_switch_active?: boolean;
  ts?: number;
  positions?: Array<{ instrument: string; qty: number; avg_price: number; pnl: number; side: string }>;
  orders?: Array<{ id: string; instrument: string; side: string; qty: number; price: number; status: string; ts?: number }>;
  connection_state?: Record<string, ConnState>;
  cash_usd?: number;
  pnl_day?: number;
}
interface MirofishMsg {
  forced_action_signal?: string;
  coherence_score?: number;
  exfiltration_opportunity?: boolean;
  agent_stress?: Record<string, number>;
}
interface SynthMsg {
  l3_quantum?: { top_allocations?: Array<{ instrument: string; weight: number; p_win: number }>; lambda_drift?: number };
  regime?: number;
  [k: string]: any;
}
interface NewsItem { id?: string; title: string; source?: string; ts?: number; url?: string; sentiment?: number }
interface RegimeMsg { regime: number | string; ts?: number }

// ---- helpers ----
const fmt = (n?: number, d = 2) => (n == null || isNaN(n) ? "—" : n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }));
const fmtMs = (n?: number) => (n == null ? "—" : n < 10 ? `${n.toFixed(1)}ms` : `${Math.round(n)}ms`);
const latColor = (ms?: number) => ms == null ? "var(--fg-2)" : ms < 200 ? "var(--up-2)" : ms < 1000 ? "var(--warn)" : "var(--down-2)";
const dotColor = (cs?: ConnState) => {
  if (!cs) return "var(--fg-2)";
  if (cs.state === "connected") return "var(--up-2)";
  if (cs.state === "reconnecting" || cs.state === "connecting") return "var(--warn)";
  return "var(--down-2)";
};
const LS_KEY = "vv-desk-prefs";
const loadPrefs = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; } };
const savePrefs = (p: any) => localStorage.setItem(LS_KEY, JSON.stringify(p));

// flash hook: returns class name when value changes
function useFlash<T>(value: T): "flash-up" | "flash-down" | "" {
  const prev = useRef<T>(value);
  const [cls, setCls] = useState<"flash-up" | "flash-down" | "">("");
  useEffect(() => {
    if (prev.current === value || prev.current == null) { prev.current = value; return; }
    const up = (value as any) > (prev.current as any);
    setCls(up ? "flash-up" : "flash-down");
    prev.current = value;
    const t = setTimeout(() => setCls(""), 80);
    return () => clearTimeout(t);
  }, [value]);
  return cls;
}

export default function Trading() {
  const [connState, setConnState] = useState<Record<string, ConnState>>({});
  const [latency, setLatency] = useState<LatencyMsg>({});
  const [regime, setRegime] = useState<RegimeMsg | null>(null);
  const [mirofish, setMirofish] = useState<MirofishMsg | null>(null);
  const [quantum, setQuantum] = useState<Record<string, number>>({});
  const [portfolio, setPortfolio] = useState<PortfolioMsg | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [synth, setSynth] = useState<SynthMsg | null>(null);
  const [ticks, setTicks] = useState<Record<string, Tick>>({});
  const [equityHist, setEquityHist] = useState<{ ts: number; value: number }[]>([]);
  const [socketConnected, setSocketConnected] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [showHelp, setShowHelp] = useState(false);
  const [intelBrief, setIntelBrief] = useState<IntelBrief | null>(null);
  const [intelRegime, setIntelRegime] = useState<RegimeState | null>(null);

  useEffect(() => {
    let alive = true;
    fetchLatestBrief().then(b => alive && b && setIntelBrief(b));
    fetchRegime().then(r => alive && r && setIntelRegime(r));
    const bId = setInterval(() => fetchLatestBrief().then(b => alive && b && setIntelBrief(b)), 15 * 60 * 1000);
    const rId = setInterval(() => fetchRegime().then(r => alive && r && setIntelRegime(r)), 2 * 60 * 1000);
    const unsub = subscribeToIntelBriefs(
      b => { if (alive) setIntelBrief(b); },
      r => { if (alive) setIntelRegime(r); },
    );
    return () => { alive = false; clearInterval(bId); clearInterval(rId); unsub(); };
  }, []);


  const tickBufRef = useRef<Record<string, Tick[]>>({});
  const socketRef = useRef<Socket | null>(null);

  const prefs = useRef<any>(loadPrefs());
  const [sortBy, setSortBy] = useState<string>(prefs.current.sortBy || "weight");
  const [filter, setFilter] = useState<string>(prefs.current.filter || "");
  useEffect(() => { savePrefs({ sortBy, filter }); }, [sortBy, filter]);

  // clock
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  // socket
  useEffect(() => {
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
    s.on("latency", (m: LatencyMsg) => setLatency(m || {}));
    s.on("regime", (m: RegimeMsg) => setRegime(m));
    s.on("mirofish", (m: MirofishMsg) => setMirofish(m));
    s.on("quantum", (m: Record<string, number>) => setQuantum(m || {}));
    s.on("portfolio", (m: PortfolioMsg) => {
      setPortfolio(m);
      if (m?.connection_state) setConnState(m.connection_state);
      if (typeof m?.value_usd === "number") {
        setEquityHist(prev => {
          const next = [...prev, { ts: m.ts ?? Date.now(), value: m.value_usd }];
          const cutoff = Date.now() - 60 * 60 * 1000;
          return next.filter(p => p.ts >= cutoff);
        });
      }
    });
    s.on("news", (m: NewsItem | NewsItem[]) => {
      const arr = Array.isArray(m) ? m : [m];
      setNews(prev => [...arr, ...prev].slice(0, 100));
    });
    s.on("synthesis", (m: SynthMsg) => setSynth(m));

    return () => { s.removeAllListeners(); s.disconnect(); };
  }, []);

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "?" || (e.shiftKey && e.key === "/")) { e.preventDefault(); setShowHelp(v => !v); }
      else if (e.key === "Escape") setShowHelp(false);
      else if (e.key === "r" || e.key === "R") reload();
      else if (e.key === "k" || e.key === "K") killSwitch();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const reload = async () => {
    try { const r = await fetch(`${HTTP_URL}/synthesis`); if (r.ok) setSynth(await r.json()); } catch {}
  };
  const killSwitch = async () => {
    if (!confirm("ENGAGE KILL SWITCH? all positions will be flattened.")) return;
    try { await fetch(`${HTTP_URL}/kill`, { method: "POST" }); } catch {}
  };

  const coh = mirofish?.coherence_score ?? 0;
  const cohOk = coh >= MIN_COHERENCE;
  const cohFlash = useFlash(cohOk ? 1 : 0);
  const acct = portfolio?.value_usd ?? 0;
  const pnl = portfolio?.pnl_day ?? 0;
  const pnlFlash = useFlash(pnl);
  const acctFlash = useFlash(acct);
  const lambda = synth?.l3_quantum?.lambda_drift;
  const regimeNum = regime?.regime ?? synth?.regime ?? "—";

  const utc = new Date(now).toISOString().slice(11, 19);
  const ny = new Date(now).toLocaleTimeString("en-US", { hour12: false, timeZone: "America/New_York" });

  // tick rows
  const tickRows = Object.values(ticks)
    .filter(t => !filter || t.instrument.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => a.instrument.localeCompare(b.instrument));

  // quantum entries
  const qEntries = Object.entries(quantum).sort((a, b) => b[1] - a[1]);
  const qTotal = qEntries.reduce((s, [, w]) => s + w, 0) || 1;
  const pWin = (inst: string) =>
    synth?.l3_quantum?.top_allocations?.find(a => a.instrument === inst)?.p_win ?? 0.5;

  return (
    <div className="vv-desk">
      <style>{css}</style>

      {/* TOP BAR */}
      <div className="vv-top">
        <span className="vv-seg vv-brand">VV·v1</span>
        <Sep />
        <span className="vv-seg" style={{ color: "var(--warn)" }}>PAPER</span>
        <Sep />
        <span className="vv-seg">
          {EXCHANGES.map(ex => {
            const cs = connState[ex];
            const age = cs?.last_msg ? Math.floor((now - cs.last_msg) / 1000) : null;
            return (
              <span key={ex} className="vv-exch" title={`${ex} · ${cs?.state || "no key"} · last_msg ${age ?? "?"}s · reconnects ${cs?.reconnects ?? 0}`}>
                <span className="vv-dot" style={{ background: dotColor(cs) }} />
                {ex}
              </span>
            );
          })}
        </span>
        <Sep />
        <span className="vv-seg vv-lat-grp">
          <span>tk:&nbsp;<b style={{ color: latColor(latency["tick"] ?? latency["tick.binance"]) }}>{fmtMs(latency["tick"] ?? latency["tick.binance"])}</b></span>
          <span>qa:&nbsp;<b style={{ color: latColor(latency["qaoa"]) }}>{fmtMs(latency["qaoa"])}</b></span>
          <span>mf:&nbsp;<b style={{ color: latColor(latency["mirofish"]) }}>{fmtMs(latency["mirofish"])}</b></span>
          <span>oll:&nbsp;<b style={{ color: latColor(latency["ollama"]) }}>{fmtMs(latency["ollama"])}</b></span>
          <span>redis:&nbsp;<b style={{ color: latColor(latency["redis"]) }}>{fmtMs(latency["redis"])}</b></span>
        </span>
        <Sep />
        <span className="vv-seg vv-mono">UTC {utc}&nbsp;&nbsp;NY {ny}</span>
        <span className="vv-spacer" />
        <span className={`vv-seg vv-mono ${cohFlash}`} style={{ color: cohOk ? "var(--up-2)" : "var(--down-2)" }}>
          COH: {coh.toFixed(2)}
        </span>
        <Sep />
        <span className="vv-seg vv-mono">REGIME #{regimeNum}</span>
        <Sep />
        <span className="vv-seg vv-mono">Δλ: {lambda != null ? lambda.toFixed(2) : "—"}</span>
        <Sep />
        <span className={`vv-seg vv-mono ${acctFlash}`}>ACC: ${fmt(acct)}</span>
        <Sep />
        <span className={`vv-seg vv-mono ${pnlFlash}`} style={{ color: pnl >= 0 ? "var(--up-2)" : "var(--down-2)" }}>
          P&L: {pnl >= 0 ? "+" : ""}{fmt(pnl)}
        </span>
        <button
          className={`vv-kill ${portfolio?.kill_switch_active ? "armed" : ""}`}
          onClick={killSwitch}
          title="K · engage kill switch"
        >
          {portfolio?.kill_switch_active ? "HALTED" : "KILL"}
        </button>
      </div>

      {/* MAIN GRID */}
      <div className="vv-main">
        {/* NAV */}
        <aside className="vv-panel vv-nav">
          <div className="vv-h">NAV</div>
          {[
            { to: "/dashboard", k: "F1", l: "INTEL" },
            { to: "/analytics", k: "F2", l: "ANALYTICS" },
            { to: "/trading", k: "F3", l: "TRADING" },
            { to: "/onion", k: "F4", l: "ONION" },
            { to: "/news", k: "F5", l: "NEWS" },
          ].map(n => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => `vv-nav-item ${isActive ? "active" : ""}`}>
              <span className="vv-nav-key">{n.k}</span>{n.l}
            </NavLink>
          ))}
          <div className="vv-h" style={{ marginTop: 8 }}>FILTER</div>
          <input className="vv-input" placeholder="symbol…" value={filter} onChange={e => setFilter(e.target.value)} />
          <div className="vv-h" style={{ marginTop: 8 }}>SORT</div>
          <select className="vv-input" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="weight">weight</option>
            <option value="name">name</option>
          </select>
          <div className="vv-h" style={{ marginTop: 8 }}>ACTIONS</div>
          <button className="vv-btn" onClick={reload}>↻ RELOAD (R)</button>
          <button className="vv-btn" onClick={() => setShowHelp(true)}>? KEYS</button>
          <div className="vv-foot">
            <span className="vv-dot" style={{ background: socketConnected ? "var(--up-2)" : "var(--down-2)" }} />
            {socketConnected ? "WS LIVE" : "WS DOWN"}
          </div>
        </aside>

        {/* PRICE GRID */}
        <section className="vv-panel vv-prices">
          <div className="vv-h vv-h-bar">
            <span>MARKET · {tickRows.length}</span>
            <span style={{ color: "var(--fg-2)" }}>top of book · 1Hz</span>
          </div>
          <div className="vv-tbl">
            <div className="vv-tr vv-th">
              <span>SYMBOL</span>
              <span className="r">BID</span>
              <span className="r">ASK</span>
              <span className="r">LAST</span>
              <span className="r">24H %</span>
              <span className="r">VOL</span>
              <span className="r">AGE</span>
            </div>
            <div className="vv-tbody">
              {tickRows.length === 0 && <div className="vv-empty">awaiting ticks…</div>}
              {tickRows.map(t => <TickRow key={t.instrument} t={t} now={now} />)}
            </div>
          </div>

          <div className="vv-h vv-h-bar" style={{ marginTop: 1 }}>
            <span>QUANTUM ALLOCATION · {qEntries.length}</span>
            <span style={{ color: "var(--quant)" }}>L3·QAOA</span>
          </div>
          <div className="vv-heat">
            {qEntries.length === 0 && <div className="vv-empty">awaiting quantum…</div>}
            {qEntries.map(([inst, w]) => {
              const pct = w / qTotal;
              const p = pWin(inst);
              const hue = Math.round(p * 130);
              return (
                <div key={inst} className="vv-heat-cell" title={`${inst} · w ${(pct*100).toFixed(1)}% · p_win ${p.toFixed(2)}`}
                  style={{ background: `hsl(${hue} 55% 28%)`, flexGrow: pct, minWidth: 64 }}>
                  <div className="vv-heat-sym">{inst}</div>
                  <div className="vv-heat-w">{(pct*100).toFixed(1)}%</div>
                  <div className="vv-heat-p">p {p.toFixed(2)}</div>
                </div>
              );
            })}
          </div>
        </section>

        {/* EQUITY */}
        <section className="vv-panel vv-equity-col">
          <div className="vv-h vv-h-bar">
            <span>EQUITY · 60M</span>
            <span style={{ color: "var(--fg-2)" }}>${fmt(acct)}</span>
          </div>
          <div className="vv-equity-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={equityHist} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="ts" tickFormatter={t => new Date(t).toLocaleTimeString().slice(0,5)} stroke="var(--fg-2)" fontSize={9} />
                <YAxis domain={["auto","auto"]} stroke="var(--fg-2)" fontSize={9} tickFormatter={v => `${(v/1000).toFixed(1)}k`} width={40} />
                <Tooltip contentStyle={{ background: "var(--bg-1)", border: "1px solid var(--line)", fontSize: 10, fontFamily: "var(--mono)" }}
                  labelFormatter={t => new Date(t as number).toLocaleTimeString()}
                  formatter={(v: any) => [`$${Number(v).toLocaleString()}`, "value"]} />
                <Line type="monotone" dataKey="value" stroke="var(--up-2)" dot={false} strokeWidth={1.5} isAnimationActive={false} />
                {portfolio?.peak_value_usd != null && (
                  <ReferenceLine y={portfolio.peak_value_usd} stroke="var(--warn)" strokeDasharray="2 3"
                    label={{ value: `peak ${fmt(portfolio.peak_value_usd, 0)}`, fill: "var(--warn)", fontSize: 9, position: "right" }} />
                )}
              </LineChart>
            </ResponsiveContainer>
            {portfolio?.kill_switch_active && <div className="vv-halt">HALTED</div>}
          </div>

          <div className="vv-h vv-h-bar" style={{ marginTop: 1 }}>COHERENCE / MIROFISH</div>
          <div className="vv-coh">
            <svg width="120" height="120" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="48" stroke="var(--bg-2)" strokeWidth="8" fill="none" />
              <circle cx="60" cy="60" r="48"
                stroke={cohOk ? "var(--up-2)" : "var(--down-2)"} strokeWidth="8" fill="none"
                strokeDasharray={`${coh * 2 * Math.PI * 48} 1000`}
                strokeLinecap="butt" transform="rotate(-90 60 60)" />
              <text x="60" y="62" textAnchor="middle" dy="6" fontFamily="var(--mono)" fontSize="22"
                fill={cohOk ? "var(--up-2)" : "var(--down-2)"}>{(coh*100).toFixed(0)}</text>
              <text x="60" y="84" textAnchor="middle" fontFamily="var(--mono)" fontSize="8" fill="var(--fg-2)">COH</text>
            </svg>
            {intelRegime && (() => {
              const col = REGIME_COLORS[intelRegime.current_state] || "var(--fg-1)";
              const next = intelRegime.most_likely_next;
              const nextProb = intelRegime.transition_probs_next_session?.[next] ?? 0;
              return (
                <div style={{ position: "absolute", left: 6, bottom: 4, fontFamily: "var(--mono)", fontSize: 9, color: col, letterSpacing: 1 }}>
                  REGIME: {REGIME_LABELS[intelRegime.current_state]} ({Math.round(nextProb * 100)}% → {REGIME_LABELS[next] || next})
                </div>
              );
            })()}
            <div className="vv-mf">
              <div className="vv-mf-head" style={{ color: mirofish?.exfiltration_opportunity ? "var(--down-2)" : "var(--warn)" }}>
                {mirofish?.forced_action_signal || "—"}
              </div>
              {["institutional_mpt","retail_momentum","hft_arbitrage","crypto_native","macro_discretionary"].map(k => {
                const v = mirofish?.agent_stress?.[k] ?? 0;
                return (
                  <div className="vv-mf-row" key={k}>
                    <span>{k.slice(0,12)}</span>
                    <div className="vv-mf-track"><div className="vv-mf-fill" style={{ width: `${Math.min(100, v*100)}%`, background: v > .7 ? "var(--down-2)" : v > .4 ? "var(--warn)" : "var(--up-2)" }} /></div>
                    <span className="r">{(v*100).toFixed(0)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* RISK + BLOTTER */}
        <section className="vv-panel vv-blotter">
          <div className="vv-h vv-h-bar">RISK</div>
          <div className="vv-risk">
            <div><span>cash</span><b>${fmt(portfolio?.cash_usd ?? 0, 0)}</b></div>
            <div><span>equity</span><b>${fmt(acct, 0)}</b></div>
            <div><span>peak</span><b>${fmt(portfolio?.peak_value_usd ?? 0, 0)}</b></div>
            <div><span>P&L day</span><b style={{ color: pnl >= 0 ? "var(--up-2)" : "var(--down-2)" }}>{pnl >= 0 ? "+" : ""}{fmt(pnl)}</b></div>
            <div><span>regime</span><b>#{regimeNum}</b></div>
            <div><span>Δλ</span><b>{lambda != null ? lambda.toFixed(3) : "—"}</b></div>
            <div><span>coherence</span><b style={{ color: cohOk ? "var(--up-2)" : "var(--down-2)" }}>{coh.toFixed(2)}</b></div>
            <div><span>positions</span><b>{portfolio?.positions?.length ?? 0}</b></div>
          </div>

          <div className="vv-h vv-h-bar" style={{ marginTop: 1 }}>POSITIONS</div>
          <div className="vv-tbl small">
            <div className="vv-tr vv-th vv-tr-pos">
              <span>SYM</span><span>SIDE</span><span className="r">QTY</span><span className="r">AVG</span><span className="r">PNL</span>
            </div>
            <div className="vv-tbody">
              {(portfolio?.positions ?? []).length === 0 && <div className="vv-empty">flat</div>}
              {(portfolio?.positions ?? []).map((p, i) => (
                <div key={i} className="vv-tr vv-tr-pos">
                  <span>{p.instrument}</span>
                  <span style={{ color: p.side === "long" ? "var(--up-2)" : "var(--down-2)" }}>{p.side?.toUpperCase()}</span>
                  <span className="r">{fmt(p.qty, 4)}</span>
                  <span className="r">{fmt(p.avg_price)}</span>
                  <span className="r" style={{ color: p.pnl >= 0 ? "var(--up-2)" : "var(--down-2)" }}>{p.pnl >= 0 ? "+" : ""}{fmt(p.pnl)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="vv-h vv-h-bar" style={{ marginTop: 1 }}>ORDER BLOTTER</div>
          <div className="vv-tbl small">
            <div className="vv-tr vv-th vv-tr-ord">
              <span>TIME</span><span>SYM</span><span>SIDE</span><span className="r">QTY</span><span className="r">PX</span><span>ST</span>
            </div>
            <div className="vv-tbody">
              {(portfolio?.orders ?? []).length === 0 && <div className="vv-empty">no orders</div>}
              {(portfolio?.orders ?? []).map(o => (
                <div key={o.id} className="vv-tr vv-tr-ord">
                  <span>{o.ts ? new Date(o.ts).toLocaleTimeString().slice(0,8) : "—"}</span>
                  <span>{o.instrument}</span>
                  <span style={{ color: o.side === "buy" ? "var(--up-2)" : "var(--down-2)" }}>{o.side?.toUpperCase()}</span>
                  <span className="r">{fmt(o.qty, 4)}</span>
                  <span className="r">{fmt(o.price)}</span>
                  <span style={{ color: o.status === "filled" ? "var(--up-2)" : o.status === "rejected" ? "var(--down-2)" : "var(--warn)" }}>{o.status?.toUpperCase().slice(0,4)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* NEWS TICKER */}
      <div className="vv-news-tick">
        <span className="vv-news-label">NEWS ▸</span>
        <div className="vv-news-track">
          {news.length === 0
            ? <span style={{ color: "var(--fg-2)" }}>awaiting feed…</span>
            : news.concat(news).map((n, i) => (
                <span key={i} className="vv-news-item">
                  <span style={{ color: n.sentiment != null ? (n.sentiment > 0 ? "var(--up-2)" : n.sentiment < 0 ? "var(--down-2)" : "var(--fg-1)") : "var(--fg-1)" }}>●</span>
                  <span style={{ color: "var(--fg-2)" }}>{n.source || "src"}</span>
                  <span>{n.title}</span>
                </span>
              ))}
        </div>
      </div>

      {/* HELP OVERLAY */}
      {showHelp && (
        <div className="vv-help" onClick={() => setShowHelp(false)}>
          <div className="vv-help-box" onClick={e => e.stopPropagation()}>
            <div className="vv-h vv-h-bar">KEYBOARD</div>
            <div className="vv-help-grid">
              <span>?</span><span>toggle this overlay</span>
              <span>R</span><span>reload synthesis</span>
              <span>K</span><span>engage kill switch</span>
              <span>Esc</span><span>close overlay</span>
              <span>F1–F5</span><span>navigate sections</span>
            </div>
            <div style={{ textAlign: "right", marginTop: 8, color: "var(--fg-2)", fontSize: 10 }}>click anywhere to close</div>
          </div>
        </div>
      )}
    </div>
  );
}

function Sep() { return <span className="vv-sep" />; }

function TickRow({ t, now }: { t: Tick; now: number }) {
  const flash = useFlash(t.price ?? t.bid ?? 0);
  const age = t.ts ? Math.max(0, Math.floor((now - t.ts) / 1000)) : null;
  const stale = age != null && age > 5;
  const ch = t.change_24h_pct;
  return (
    <div className={`vv-tr ${stale ? "stale" : ""}`}>
      <span>{t.instrument}</span>
      <span className="r">{fmt(t.bid)}</span>
      <span className="r">{fmt(t.ask)}</span>
      <span className={`r ${flash}`}>{fmt(t.price ?? t.bid)}</span>
      <span className="r" style={{ color: ch == null ? "var(--fg-2)" : ch >= 0 ? "var(--up-2)" : "var(--down-2)" }}>
        {ch == null ? "—" : `${ch >= 0 ? "+" : ""}${ch.toFixed(2)}%`}
      </span>
      <span className="r">{t.volume != null ? fmt(t.volume, 0) : "—"}</span>
      <span className="r" style={{ color: stale ? "var(--warn)" : "var(--fg-2)" }}>{age != null ? `${age}s` : "—"}</span>
    </div>
  );
}

const css = `
.vv-desk {
  --bg-0:#0a0e1a; --bg-1:#11151f; --bg-2:#1a1f2c; --line:#232838;
  --fg-0:#d8dde8; --fg-1:#8892a8; --fg-2:#525a72;
  --up:#0f6e56; --up-2:#1ba68a; --down:#c0392b; --down-2:#e84c3a;
  --warn:#b8860b; --quant:#6c3fcf; --signal:#b8860b;
  --mono: 'JetBrains Mono','IBM Plex Mono','SF Mono',Menlo,Consolas,monospace;
  position: fixed; inset: 0; background: var(--bg-0); color: var(--fg-0);
  font-family: 'Inter', system-ui, sans-serif; font-size: 12px;
  display: grid; grid-template-rows: 36px 1fr 28px; overflow: hidden;
}
.vv-desk * { box-sizing: border-box; }
.vv-mono, .vv-desk .r, .vv-desk .vv-tr, .vv-desk .vv-input { font-family: var(--mono); font-variant-numeric: tabular-nums; }
.vv-top {
  display: flex; align-items: center; height: 36px; padding: 0 8px;
  background: var(--bg-1); border-bottom: 1px solid var(--line);
  font-family: var(--mono); font-size: 11px; gap: 6px; overflow: hidden;
  position: relative;
}
.vv-top::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 1px; background: rgba(255,255,255,0.04); }
.vv-seg { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; color: var(--fg-0); }
.vv-brand { color: var(--quant); font-weight: 700; letter-spacing: 1px; }
.vv-sep { width: 1px; height: 18px; background: var(--line); margin: 0 2px; }
.vv-spacer { flex: 1; }
.vv-exch { display: inline-flex; align-items: center; gap: 4px; margin-right: 6px; color: var(--fg-1); }
.vv-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.vv-lat-grp > span { margin-right: 8px; color: var(--fg-1); }
.vv-lat-grp b { font-weight: 600; }
.vv-kill {
  margin-left: 8px; height: 26px; min-width: 78px; padding: 0 10px;
  background: var(--bg-2); border: 1px solid var(--down); color: var(--down-2);
  font-family: var(--mono); font-size: 11px; font-weight: 700; letter-spacing: 2px;
  cursor: pointer;
}
.vv-kill:hover { background: var(--down); color: #fff; }
.vv-kill.armed { background: var(--down-2); color: #fff; animation: killpulse 1.4s ease-in-out infinite; }
@keyframes killpulse { 0%,100% { box-shadow: inset 0 0 0 1px var(--down-2); } 50% { box-shadow: inset 0 0 0 1px #fff; } }

.vv-main {
  display: grid; grid-template-columns: 200px 1fr 360px 320px;
  gap: 1px; background: var(--line); overflow: hidden; min-height: 0;
}
.vv-panel {
  background: var(--bg-1); position: relative; display: flex; flex-direction: column;
  min-height: 0; overflow: hidden;
}
.vv-panel::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 1px; background: rgba(255,255,255,0.04); pointer-events: none; }
.vv-h {
  font-family: var(--mono); font-size: 9px; letter-spacing: 2px; color: var(--fg-2);
  padding: 4px 6px; background: var(--bg-0); border-bottom: 1px solid var(--line);
  text-transform: uppercase;
}
.vv-h-bar { display: flex; justify-content: space-between; align-items: center; }

.vv-nav { padding: 0; }
.vv-nav-item {
  display: flex; align-items: center; gap: 6px; padding: 5px 8px;
  font-family: var(--mono); font-size: 11px; color: var(--fg-1); text-decoration: none;
  border-left: 2px solid transparent;
}
.vv-nav-item:hover { background: var(--bg-2); color: var(--fg-0); }
.vv-nav-item.active { color: var(--up-2); border-left-color: var(--up-2); background: var(--bg-2); }
.vv-nav-key { color: var(--fg-2); width: 28px; }
.vv-input {
  margin: 4px 6px; padding: 3px 6px; background: var(--bg-0); border: 1px solid var(--line);
  color: var(--fg-0); font-family: var(--mono); font-size: 11px; outline: none;
}
.vv-input:focus { border-color: var(--up-2); }
.vv-btn {
  margin: 2px 6px; padding: 4px 6px; background: var(--bg-2); border: 1px solid var(--line);
  color: var(--fg-0); font-family: var(--mono); font-size: 10px; cursor: pointer;
  text-align: left; letter-spacing: 1px;
}
.vv-btn:hover { background: var(--bg-0); border-color: var(--up-2); color: var(--up-2); }
.vv-foot { margin-top: auto; padding: 4px 8px; font-family: var(--mono); font-size: 10px; color: var(--fg-1); display: flex; align-items: center; gap: 6px; border-top: 1px solid var(--line); }

.vv-tbl { display: flex; flex-direction: column; min-height: 0; flex: 1; }
.vv-tbody { flex: 1; overflow: auto; min-height: 0; }
.vv-tr {
  display: grid; grid-template-columns: 1.4fr .9fr .9fr .9fr .8fr .9fr .5fr;
  padding: 2px 6px; font-size: 11px; border-bottom: 1px solid var(--line);
  align-items: center;
}
.vv-tr:hover { background: var(--bg-2); }
.vv-th { background: var(--bg-0); color: var(--fg-2); font-size: 9px; letter-spacing: 1px; padding: 3px 6px; }
.vv-tbl .r { text-align: right; }
.vv-tr.stale { opacity: .5; }
.vv-tbl.small .vv-tr { font-size: 10px; padding: 2px 6px; }
.vv-tr-pos { grid-template-columns: 1.2fr .6fr .9fr .9fr .9fr; }
.vv-tr-ord { grid-template-columns: .9fr 1fr .6fr .9fr .9fr .5fr; }
.vv-empty { padding: 8px; color: var(--fg-2); font-family: var(--mono); font-size: 10px; text-align: center; }

.flash-up { background: var(--up) !important; color: #fff !important; transition: background 80ms linear, color 80ms linear; }
.flash-down { background: var(--down) !important; color: #fff !important; transition: background 80ms linear, color 80ms linear; }

.vv-heat { display: flex; flex-wrap: wrap; gap: 1px; padding: 1px; max-height: 180px; overflow: auto; }
.vv-heat-cell { padding: 4px 6px; font-family: var(--mono); font-size: 10px; color: #e8eef5; border: 1px solid rgba(0,0,0,.3); }
.vv-heat-sym { font-weight: 700; }
.vv-heat-w { color: rgba(255,255,255,.85); }
.vv-heat-p { color: rgba(255,255,255,.6); font-size: 9px; }

.vv-equity-col { min-height: 0; }
.vv-equity-chart { flex: 0 0 220px; position: relative; padding: 2px; }
.vv-halt { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  background: rgba(192,57,43,.25); color: var(--down-2); font-family: var(--mono); font-size: 32px; letter-spacing: 8px;
  border: 2px solid var(--down-2); }
.vv-coh { display: flex; gap: 8px; padding: 6px; flex: 1; min-height: 0; }
.vv-mf { flex: 1; display: flex; flex-direction: column; gap: 3px; font-family: var(--mono); font-size: 10px; min-width: 0; }
.vv-mf-head { font-size: 13px; letter-spacing: 1px; padding: 2px 0 4px; }
.vv-mf-row { display: grid; grid-template-columns: 80px 1fr 28px; gap: 4px; align-items: center; color: var(--fg-1); }
.vv-mf-track { height: 6px; background: var(--bg-0); }
.vv-mf-fill { height: 100%; }
.vv-mf-row .r { color: var(--fg-0); }

.vv-risk { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--line); }
.vv-risk > div { background: var(--bg-1); padding: 4px 6px; display: flex; justify-content: space-between; font-family: var(--mono); font-size: 10px; }
.vv-risk span { color: var(--fg-2); }
.vv-risk b { color: var(--fg-0); font-weight: 600; }

.vv-news-tick {
  display: flex; align-items: center; height: 28px; background: var(--bg-1);
  border-top: 1px solid var(--line); overflow: hidden; font-family: var(--mono); font-size: 11px;
}
.vv-news-label { padding: 0 8px; color: var(--warn); font-weight: 700; letter-spacing: 1px; border-right: 1px solid var(--line); height: 100%; display: flex; align-items: center; flex-shrink: 0; }
.vv-news-track { display: flex; gap: 24px; white-space: nowrap; animation: tick 90s linear infinite; padding-left: 16px; }
.vv-news-item { display: inline-flex; gap: 6px; align-items: center; }
@keyframes tick { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }

.vv-help { position: fixed; inset: 0; background: rgba(10,14,26,.85); display: flex; align-items: center; justify-content: center; z-index: 100; }
.vv-help-box { background: var(--bg-1); border: 1px solid var(--line); padding: 12px; min-width: 320px; }
.vv-help-grid { display: grid; grid-template-columns: 80px 1fr; gap: 6px 12px; padding: 8px 4px; font-family: var(--mono); font-size: 11px; }
.vv-help-grid > span:nth-child(odd) { color: var(--up-2); }
`;
