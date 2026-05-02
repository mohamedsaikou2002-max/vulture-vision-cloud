import { useEffect, useState } from "react";
import VVLayout from "@/components/VVLayout";
import { supabase } from "@/integrations/supabase/client";

interface Crypto {
  symbol: string;
  name: string;
  price: number;
  change_1h: number;
  change_24h: number;
  change_7d: number;
  market_cap: number;
  volume_24h: number;
}
interface Asset {
  symbol: string;
  type: string;
  regime: string;
  rsi: number;
  macd_hist: number;
  quantum: { score: number; interference: number; entanglement: number };
  stats: { sharpe_ratio: number; ann_volatility: number };
  mc_30d: { p50: number; prob_up: number; prob_down: number };
}
interface Portfolio {
  dominant_regime: string;
  avg_quantum_score: number;
  avg_prob_up_30d: number;
  avg_sharpe: number;
}
interface Full {
  crypto: Crypto[];
  assets: Asset[];
  portfolio: Portfolio;
  narrative?: string;
  ts?: string;
}

const fP = (n?: number) => (n == null || isNaN(n) ? "—" : n > 1000 ? "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 }) : n > 1 ? "$" + n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "$" + n.toFixed(4));
const fPct = (n?: number) => (n == null || isNaN(n) ? "—" : (n >= 0 ? "+" : "") + n.toFixed(2) + "%");
const fBig = (n?: number) => (!n ? "—" : n >= 1e12 ? "$" + (n / 1e12).toFixed(2) + "T" : n >= 1e9 ? "$" + (n / 1e9).toFixed(2) + "B" : n >= 1e6 ? "$" + (n / 1e6).toFixed(2) + "M" : "$" + n.toLocaleString());
const f2 = (n?: number) => (n == null || isNaN(n) ? "—" : n.toFixed(2));
const f4 = (n?: number) => (n == null || isNaN(n) ? "—" : n.toFixed(4));
const dir = (n?: number) => (n != null && n >= 0 ? "up" : "down");

const regimeBadge = (r?: string) => {
  const cls = ({ BULL: "badge-green", BEAR: "badge-red", VOLATILE: "badge-yellow", SIDEWAYS: "badge-navy" } as any)[r || ""] || "badge-dim";
  return { cls, label: r || "—" };
};

export default function Analytics() {
  const [data, setData] = useState<Full | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const { data: res, error } = await supabase.functions.invoke("vv-analytics");
        if (!alive) return;
        if (error || !res) { setOnline(false); return; }
        setData(res as Full);
        setOnline(true);
      } catch {
        if (alive) setOnline(false);
      }
    }
    load();
    const id = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const status = online === null
    ? { label: "CONNECTING", tone: "gold" as const }
    : online
      ? { label: "ENGINE ONLINE", tone: "green" as const }
      : { label: "ENGINE OFFLINE", tone: "red" as const };

  const btc = data?.crypto.find(c => c.symbol === "BTC");
  const eth = data?.crypto.find(c => c.symbol === "ETH");
  const spy = data?.assets.find(a => a.symbol === "SPY");
  const port = data?.portfolio;
  const reg = regimeBadge(port?.dominant_regime);

  return (
    <VVLayout status={status as any}>
      <div className="scroll-inner">
        <div className="stat-row">
          <div className="stat-card panel">
            <div className="stat-label">S&amp;P 500 / SPY</div>
            <div className="stat-value">{spy ? fP(spy.mc_30d.p50) : "—"}</div>
            <div className={`stat-delta ${spy && spy.mc_30d.prob_up > 0.5 ? "up" : "down"}`}>
              {spy ? `P↑ ${(spy.mc_30d.prob_up * 100).toFixed(1)}%  Sharpe ${f2(spy.stats.sharpe_ratio)}` : "loading..."}
            </div>
          </div>
          <div className="stat-card panel">
            <div className="stat-label">BITCOIN / BTC</div>
            <div className="stat-value">{btc ? fP(btc.price) : "—"}</div>
            <div className={`stat-delta ${dir(btc?.change_24h)}`}>{btc ? `${fPct(btc.change_24h)} 24h` : "loading..."}</div>
          </div>
          <div className="stat-card panel">
            <div className="stat-label">ETHEREUM / ETH</div>
            <div className="stat-value">{eth ? fP(eth.price) : "—"}</div>
            <div className={`stat-delta ${dir(eth?.change_24h)}`}>{eth ? `${fPct(eth.change_24h)} 24h` : "loading..."}</div>
          </div>
          <div className="stat-card panel">
            <div className="stat-label">PORTFOLIO REGIME</div>
            <div className="stat-value regime-val">
              <span className={`badge ${reg.cls}`}>{reg.label}</span>
            </div>
            <div className="stat-delta">quantum score: {f4(port?.avg_quantum_score)}</div>
          </div>
          <div className="stat-card panel">
            <div className="stat-label">AVG PROB UP 30D</div>
            <div className={`stat-value ${port && port.avg_prob_up_30d > 0.5 ? "up" : "down"}`}>
              {port ? (port.avg_prob_up_30d * 100).toFixed(1) + "%" : "—"}
            </div>
            <div className="stat-delta">avg sharpe: {f2(port?.avg_sharpe)}</div>
          </div>
        </div>

        <div className="analytics-wrap">
          <div className="panel" style={{ padding: 14 }}>
            <div className="panel-title">QUANTUM AMPLITUDE SCORES — Born Rule · Interference · Entanglement</div>
            <div className="quantum-wrap">
              {!data?.assets.length && <div className="q-loading">⬡ AWAITING ENGINE OUTPUT...</div>}
              {data?.assets.map(a => {
                const q = a.quantum?.score || 0;
                const pct = (q * 100).toFixed(1);
                const col = q > 0.65 ? "#00e676" : q > 0.4 ? "#00bcd4" : "#ff3d3d";
                return (
                  <div className="q-row" key={a.symbol}>
                    <span className="q-sym">{a.symbol}</span>
                    <div className="q-track">
                      <div className="q-fill" style={{ width: `${pct}%`, background: `linear-gradient(90deg,#1565c0,${col})` }} />
                    </div>
                    <span className="q-score" style={{ color: col }}>{f4(q)}</span>
                    <span className="q-detail">INT:{f4(a.quantum.interference)} ENT:{f4(a.quantum.entanglement)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="panel" style={{ padding: 14, marginTop: 14 }}>
            <div className="panel-title">ASSET OVERVIEW — {data?.assets.length || 0} ASSETS</div>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>SYMBOL</th><th>TYPE</th><th>REGIME</th>
                    <th>RSI</th><th>MACD HIST</th><th>QUANTUM</th>
                    <th>SHARPE</th><th>ANN VOL</th><th>P↑ 30D</th><th>P↓ 30D</th>
                  </tr>
                </thead>
                <tbody>
                  {!data?.assets.length && <tr><td colSpan={10} className="empty-cell">Loading asset data...</td></tr>}
                  {data?.assets.map(a => {
                    const r = regimeBadge(a.regime);
                    return (
                      <tr key={a.symbol}>
                        <td>{a.symbol}</td>
                        <td>{a.type}</td>
                        <td><span className={`badge ${r.cls}`}>{r.label}</span></td>
                        <td>{f2(a.rsi)}</td>
                        <td className={dir(a.macd_hist)}>{f4(a.macd_hist)}</td>
                        <td>{f4(a.quantum.score)}</td>
                        <td>{f2(a.stats.sharpe_ratio)}</td>
                        <td>{f2(a.stats.ann_volatility)}</td>
                        <td className="up">{(a.mc_30d.prob_up * 100).toFixed(1)}%</td>
                        <td className="down">{(a.mc_30d.prob_down * 100).toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel" style={{ padding: 14, marginTop: 14 }}>
            <div className="panel-title">CRYPTO MARKET WATCH — CoinGecko · Live</div>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ASSET</th><th>PRICE</th><th>1H</th><th>24H</th><th>7D</th><th>MARKET CAP</th><th>VOLUME 24H</th>
                  </tr>
                </thead>
                <tbody>
                  {!data?.crypto.length && <tr><td colSpan={7} className="empty-cell">Loading...</td></tr>}
                  {data?.crypto.map(c => (
                    <tr key={c.symbol}>
                      <td>{c.symbol} <span style={{ color: "var(--dim)" }}>· {c.name}</span></td>
                      <td>{fP(c.price)}</td>
                      <td className={dir(c.change_1h)}>{fPct(c.change_1h)}</td>
                      <td className={dir(c.change_24h)}>{fPct(c.change_24h)}</td>
                      <td className={dir(c.change_7d)}>{fPct(c.change_7d)}</td>
                      <td>{fBig(c.market_cap)}</td>
                      <td>{fBig(c.volume_24h)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel narrative-panel" style={{ marginTop: 14 }}>
            <div className="narrative-header">
              <div className="status-dot" style={{ background: data?.narrative ? "var(--green)" : "var(--dim)" }} />
              <span className="panel-title" style={{ marginBottom: 0 }}>VULTURE AI — MARKET INTELLIGENCE BRIEF</span>
              <span className="narrative-ts">{data?.ts ? new Date(data.ts).toLocaleTimeString() : ""}</span>
            </div>
            <div className="narrative-body">
              {data?.narrative || <span className="dim-text">⬡ COMPUTING PROBABILISTIC ANALYSIS...</span>}
            </div>
          </div>
        </div>
      </div>
    </VVLayout>
  );
}
