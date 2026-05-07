import { useEffect, useState } from "react";
import VVLayout from "@/components/VVLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Trade {
  id: string;
  instrument: string;
  side: string;
  qty: number;
  price: number;
  pnl: number | null;
  mode: string;
  meta: Record<string, any>;
  created_at: string;
}
interface Synth {
  id: string;
  thesis: any;
  antithesis: any;
  synthesis: any;
  narrative: string | null;
  score: number | null;
  created_at: string;
}
interface Alert {
  id: string;
  level: string;
  reason: string;
  source: string | null;
  payload: any;
  created_at: string;
}
interface Tick {
  id: string;
  bid: number;
  ask: number;
  mid: number;
  last: number;
  change_24h_pct: number;
  ofi: number;
}
interface QState {
  n_qubits: number;
  labels: string[];
  coherence: number;
  dominant: number;
  top: { i: number; p: number }[];
  backend: string;
  ts: string;
}
interface Mirofish {
  verdict: string;
  confidence: number;
  drift: number;
  ofi: number;
  coherence: number;
  instruments: number;
  ts: string;
}

const PAPER_GATE = {
  min_win_rate: 0.55,
  min_sharpe: 1.5,
  max_drawdown: 0.15,
  min_weeks_clean: 3,
  min_trades: 30,
};

const RISK = {
  MAX_POSITION_SIZE_USD: 100,
  MAX_PORTFOLIO_EXPOSURE: 0.9,
  MAX_DRAWDOWN_THRESHOLD: 0.15,
  MIN_ORDER_USD: 5,
};

const fUsd = (n: number | null | undefined) => n == null ? "—" : (n >= 0 ? "+" : "") + "$" + Math.abs(n).toFixed(2);
const fNum = (n: number | null | undefined, d = 2) => n == null || isNaN(n) ? "—" : n.toFixed(d);
const fPct = (n: number | null | undefined) => n == null ? "—" : (n >= 0 ? "+" : "") + n.toFixed(2) + "%";
const dir = (n?: number | null) => (n != null && n >= 0 ? "up" : "down");

const sideBadge = (s: string) => s.toUpperCase() === "BUY" ? "badge-green" : "badge-red";
const levelBadge = (l: string) => ({ critical: "badge-red", warning: "badge-yellow", info: "badge-navy" } as any)[l] || "badge-dim";

export default function Trading() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [totalPnl, setTotalPnl] = useState(0);
  const [synth, setSynth] = useState<Synth[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [killActive, setKillActive] = useState(false);
  const [ticks, setTicks] = useState<Tick[]>([]);
  const [qstate, setQstate] = useState<QState | null>(null);
  const [mirofish, setMirofish] = useState<Mirofish | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);

  // form state
  const [instrument, setInstrument] = useState("BTCUSDT");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [qty, setQty] = useState("0.001");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadAll() {
    try {
      const [t, s, k, m] = await Promise.all([
        supabase.functions.invoke("vv-trades"),
        supabase.functions.invoke("vv-synthesis"),
        supabase.functions.invoke("vv-killswitch"),
        supabase.functions.invoke("vv-market"),
      ]);
      if (t.data) { setTrades(t.data.trades || []); setTotalPnl(t.data.total_pnl || 0); }
      if (s.data) setSynth(s.data.entries || []);
      if (k.data) { setAlerts(k.data.alerts || []); setKillActive(!!k.data.active); }
      if (m.data) setTicks(m.data.ticks || []);
      setOnline(true);
    } catch {
      setOnline(false);
    }
  }

  useEffect(() => {
    loadAll();
    const id = setInterval(loadAll, 30_000);
    return () => clearInterval(id);
  }, []);

  async function submitTrade(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const qtyN = parseFloat(qty);
    const priceN = parseFloat(price);
    const notional = qtyN * priceN;
    if (notional < RISK.MIN_ORDER_USD) {
      toast.error(`Order below MIN_ORDER_USD ($${RISK.MIN_ORDER_USD})`);
      setBusy(false); return;
    }
    if (notional > RISK.MAX_POSITION_SIZE_USD) {
      toast.error(`Order exceeds MAX_POSITION_SIZE_USD ($${RISK.MAX_POSITION_SIZE_USD})`);
      setBusy(false); return;
    }
    if (killActive) {
      toast.error("KILL SWITCH ACTIVE — trading halted");
      setBusy(false); return;
    }
    const { error } = await supabase.functions.invoke("vv-trades", {
      body: { instrument, side, qty: qtyN, price: priceN, mode: "paper", meta: { source: "manual" } },
    });
    setBusy(false);
    if (error) { toast.error("Trade failed: " + error.message); return; }
    toast.success(`${side} ${qtyN} ${instrument} @ ${priceN}`);
    setPrice("");
    loadAll();
  }

  async function toggleKill(active: boolean) {
    const { error } = await supabase.functions.invoke("vv-killswitch", {
      body: {
        level: active ? "critical" : "info",
        reason: active ? "Manual kill-switch engage" : "Manual kill-switch release",
        source: "trading_ui",
        set_active: active,
      },
    });
    if (error) { toast.error(error.message); return; }
    toast(active ? "KILL SWITCH ENGAGED" : "Kill switch released");
    loadAll();
  }

  // metrics
  const closed = trades.filter(t => t.pnl != null);
  const wins = closed.filter(t => (t.pnl || 0) > 0).length;
  const winRate = closed.length ? wins / closed.length : 0;
  const grossExposure = trades.reduce((s, t) => s + Math.abs(t.qty * t.price), 0);
  const exposurePct = grossExposure / Math.max(RISK.MAX_POSITION_SIZE_USD * 10, 1);

  const status = online === null
    ? { label: "CONNECTING", tone: "gold" as const }
    : killActive
      ? { label: "KILL SWITCH ACTIVE", tone: "red" as const }
      : online
        ? { label: "PAPER ENGINE LIVE", tone: "green" as const }
        : { label: "ENGINE OFFLINE", tone: "red" as const };

  return (
    <VVLayout status={status as any}>
      <div className="scroll-inner">
        {/* Stat row */}
        <div className="stat-row">
          <div className="stat-card panel">
            <div className="stat-label">TRADING MODE</div>
            <div className="stat-value"><span className="badge badge-yellow">PAPER</span></div>
            <div className="stat-delta">live gate locked</div>
          </div>
          <div className="stat-card panel">
            <div className="stat-label">TOTAL PNL</div>
            <div className={`stat-value ${dir(totalPnl)}`}>{fUsd(totalPnl)}</div>
            <div className="stat-delta">{closed.length} closed · {trades.length} total</div>
          </div>
          <div className="stat-card panel">
            <div className="stat-label">WIN RATE</div>
            <div className={`stat-value ${winRate >= PAPER_GATE.min_win_rate ? "up" : "down"}`}>
              {(winRate * 100).toFixed(1)}%
            </div>
            <div className="stat-delta">gate ≥ {(PAPER_GATE.min_win_rate * 100).toFixed(0)}%</div>
          </div>
          <div className="stat-card panel">
            <div className="stat-label">EXPOSURE</div>
            <div className="stat-value">{fUsd(grossExposure)}</div>
            <div className="stat-delta">cap ${RISK.MAX_POSITION_SIZE_USD * 10}</div>
          </div>
          <div className="stat-card panel">
            <div className="stat-label">KILL SWITCH</div>
            <div className="stat-value">
              <span className={`badge ${killActive ? "badge-red" : "badge-green"}`}>
                {killActive ? "ENGAGED" : "ARMED"}
              </span>
            </div>
            <div className="stat-delta">{alerts.length} alerts</div>
          </div>
        </div>

        <div className="analytics-wrap">
          {/* Order ticket + kill switch */}
          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 14 }}>
            <div className="panel" style={{ padding: 14 }}>
              <div className="panel-title">PAPER ORDER TICKET — PAPER MODE ONLY</div>
              <form onSubmit={submitTrade} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: ".62rem", letterSpacing: ".14em", color: "var(--dim)" }}>
                  INSTRUMENT
                  <select value={instrument} onChange={e => setInstrument(e.target.value)}
                    style={{ background: "rgba(0,0,0,.4)", border: "1px solid rgba(0,230,118,.2)", color: "var(--text)", padding: "8px 10px", fontSize: ".75rem" }}>
                    {ticks.length ? ticks.map(t => <option key={t.id} value={t.id}>{t.id}</option>)
                      : <option value="BTCUSDT">BTCUSDT</option>}
                  </select>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: ".62rem", letterSpacing: ".14em", color: "var(--dim)" }}>
                  SIDE
                  <select value={side} onChange={e => setSide(e.target.value as any)}
                    style={{ background: "rgba(0,0,0,.4)", border: "1px solid rgba(0,230,118,.2)", color: "var(--text)", padding: "8px 10px", fontSize: ".75rem" }}>
                    <option value="BUY">BUY</option>
                    <option value="SELL">SELL</option>
                  </select>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: ".62rem", letterSpacing: ".14em", color: "var(--dim)" }}>
                  QTY
                  <input value={qty} onChange={e => setQty(e.target.value)} type="number" step="any" min="0"
                    style={{ background: "rgba(0,0,0,.4)", border: "1px solid rgba(0,230,118,.2)", color: "var(--text)", padding: "8px 10px", fontSize: ".75rem" }} />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: ".62rem", letterSpacing: ".14em", color: "var(--dim)" }}>
                  PRICE
                  <input value={price} onChange={e => setPrice(e.target.value)} type="number" step="any" min="0" required
                    placeholder={ticks.find(t => t.id === instrument)?.mid.toFixed(2) || ""}
                    style={{ background: "rgba(0,0,0,.4)", border: "1px solid rgba(0,230,118,.2)", color: "var(--text)", padding: "8px 10px", fontSize: ".75rem" }} />
                </label>
                <button disabled={busy || killActive} type="submit"
                  style={{ background: side === "BUY" ? "rgba(0,230,118,.15)" : "rgba(255,34,34,.15)",
                           border: `1px solid ${side === "BUY" ? "var(--green-bright)" : "var(--red)"}`,
                           color: side === "BUY" ? "var(--green-bright)" : "var(--red)",
                           padding: "10px 18px", fontSize: ".7rem", letterSpacing: ".18em", cursor: "pointer",
                           opacity: busy || killActive ? .4 : 1 }}>
                  {busy ? "..." : `EXEC ${side}`}
                </button>
              </form>
              <div style={{ marginTop: 10, fontSize: ".62rem", color: "var(--dim)", letterSpacing: ".1em" }}>
                limits: ${RISK.MIN_ORDER_USD} ≤ notional ≤ ${RISK.MAX_POSITION_SIZE_USD} · stop {RISK.MAX_DRAWDOWN_THRESHOLD * 100}% drawdown
              </div>
            </div>

            <div className="panel" style={{ padding: 14 }}>
              <div className="panel-title">KILL SWITCH CONTROL</div>
              <div style={{ fontSize: ".72rem", color: "var(--text)", lineHeight: 1.6, marginBottom: 12 }}>
                Engaging the kill switch immediately blocks all new orders and writes a critical alert. Use only when systems are misbehaving.
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => toggleKill(true)} disabled={killActive}
                  style={{ flex: 1, background: "rgba(255,34,34,.15)", border: "1px solid var(--red)", color: "var(--red)",
                           padding: "10px", fontSize: ".7rem", letterSpacing: ".18em", cursor: "pointer", opacity: killActive ? .4 : 1 }}>
                  ENGAGE
                </button>
                <button onClick={() => toggleKill(false)} disabled={!killActive}
                  style={{ flex: 1, background: "rgba(0,230,118,.15)", border: "1px solid var(--green-bright)", color: "var(--green-bright)",
                           padding: "10px", fontSize: ".7rem", letterSpacing: ".18em", cursor: "pointer", opacity: !killActive ? .4 : 1 }}>
                  RELEASE
                </button>
              </div>
            </div>
          </div>

          {/* Live ticks */}
          <div className="panel" style={{ padding: 14, marginTop: 14 }}>
            <div className="panel-title">LIVE MARKET — BINANCE · {ticks.length} INSTRUMENTS</div>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>SYMBOL</th><th>BID</th><th>ASK</th><th>MID</th><th>LAST</th><th>24H</th><th>OFI</th>
                  </tr>
                </thead>
                <tbody>
                  {!ticks.length && <tr><td colSpan={7} className="empty-cell">Awaiting market feed...</td></tr>}
                  {ticks.map(t => (
                    <tr key={t.id}>
                      <td>{t.id}</td>
                      <td>{fNum(t.bid, 4)}</td>
                      <td>{fNum(t.ask, 4)}</td>
                      <td>{fNum(t.mid, 4)}</td>
                      <td>{fNum(t.last, 4)}</td>
                      <td className={dir(t.change_24h_pct)}>{fPct(t.change_24h_pct)}</td>
                      <td className={dir(t.ofi)}>{fNum(t.ofi, 3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Trade history */}
          <div className="panel" style={{ padding: 14, marginTop: 14 }}>
            <div className="panel-title">TRADE HISTORY — {trades.length} ORDERS</div>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>TS</th><th>INSTRUMENT</th><th>SIDE</th><th>QTY</th><th>PRICE</th><th>NOTIONAL</th><th>PNL</th><th>MODE</th>
                  </tr>
                </thead>
                <tbody>
                  {!trades.length && <tr><td colSpan={8} className="empty-cell">No trades yet.</td></tr>}
                  {trades.map(t => (
                    <tr key={t.id}>
                      <td>{new Date(t.created_at).toLocaleTimeString()}</td>
                      <td>{t.instrument}</td>
                      <td><span className={`badge ${sideBadge(t.side)}`}>{t.side.toUpperCase()}</span></td>
                      <td>{fNum(t.qty, 6)}</td>
                      <td>{fNum(t.price, 4)}</td>
                      <td>{fUsd(t.qty * t.price)}</td>
                      <td className={dir(t.pnl)}>{fUsd(t.pnl)}</td>
                      <td><span className="badge badge-dim">{t.mode}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Synthesis + alerts */}
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14, marginTop: 14 }}>
            <div className="panel" style={{ padding: 14 }}>
              <div className="panel-title">HEGELIAN SYNTHESIS HISTORY</div>
              {!synth.length && <div className="dim-text">⬡ no synthesis snapshots yet</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 360, overflowY: "auto" }}>
                {synth.map(s => (
                  <div key={s.id} style={{ borderLeft: "2px solid var(--gold)", padding: "6px 12px", background: "rgba(0,0,0,.25)" }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", fontSize: ".6rem", color: "var(--dim)", letterSpacing: ".14em" }}>
                      <span>{new Date(s.created_at).toLocaleString()}</span>
                      {s.score != null && <span className="badge badge-navy">SCORE {s.score.toFixed(3)}</span>}
                    </div>
                    {s.narrative && <div style={{ fontSize: ".72rem", color: "var(--text)", marginTop: 6, lineHeight: 1.6 }}>{s.narrative}</div>}
                  </div>
                ))}
              </div>
            </div>

            <div className="panel" style={{ padding: 14 }}>
              <div className="panel-title">KILL SWITCH ALERTS</div>
              {!alerts.length && <div className="dim-text">⬡ no alerts</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 360, overflowY: "auto" }}>
                {alerts.map(a => (
                  <div key={a.id} style={{ padding: "8px 12px", background: "rgba(0,0,0,.3)", borderLeft: `2px solid ${a.level === "critical" ? "var(--red)" : a.level === "warning" ? "#ffcc00" : "var(--blue-accent)"}` }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: ".58rem", color: "var(--dim)", letterSpacing: ".14em" }}>
                      <span className={`badge ${levelBadge(a.level)}`}>{a.level.toUpperCase()}</span>
                      <span>{new Date(a.created_at).toLocaleTimeString()}</span>
                      {a.source && <span>· {a.source}</span>}
                    </div>
                    <div style={{ fontSize: ".72rem", color: "var(--text)", marginTop: 4 }}>{a.reason}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Paper gate */}
          <div className="panel" style={{ padding: 14, marginTop: 14 }}>
            <div className="panel-title">PAPER → LIVE PROMOTION GATE</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
              {[
                { label: "WIN RATE", value: `${(winRate * 100).toFixed(1)}%`, target: `≥ ${(PAPER_GATE.min_win_rate * 100).toFixed(0)}%`, ok: winRate >= PAPER_GATE.min_win_rate },
                { label: "MIN TRADES", value: `${closed.length}`, target: `≥ ${PAPER_GATE.min_trades}`, ok: closed.length >= PAPER_GATE.min_trades },
                { label: "MAX DRAWDOWN", value: `${(RISK.MAX_DRAWDOWN_THRESHOLD * 100).toFixed(0)}%`, target: `≤ ${(PAPER_GATE.max_drawdown * 100).toFixed(0)}%`, ok: true },
                { label: "MIN SHARPE", value: "—", target: `≥ ${PAPER_GATE.min_sharpe}`, ok: false },
                { label: "WEEKS CLEAN", value: "0", target: `≥ ${PAPER_GATE.min_weeks_clean}`, ok: false },
              ].map(g => (
                <div key={g.label} style={{ padding: "10px 12px", border: `1px solid ${g.ok ? "rgba(0,230,118,.4)" : "rgba(58,90,74,.4)"}`, background: "rgba(0,0,0,.25)" }}>
                  <div style={{ fontSize: ".6rem", letterSpacing: ".14em", color: "var(--dim)" }}>{g.label}</div>
                  <div style={{ fontSize: "1rem", color: g.ok ? "var(--green-bright)" : "var(--text)", margin: "6px 0" }}>{g.value}</div>
                  <div style={{ fontSize: ".55rem", color: "var(--dim)", letterSpacing: ".1em" }}>{g.target}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </VVLayout>
  );
}
