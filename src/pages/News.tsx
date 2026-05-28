import { useEffect, useState } from "react";
import VVLayout from "@/components/VVLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchLatestBrief, subscribeToIntelBriefs, triggerSynthesis,
  IntelBrief, dirArrow, dirClass, confidenceLabel, timeAgoShort,
} from "@/lib/intelApi";

interface Item {
  title: string;
  source?: string;
  time?: string;
  link?: string;
  journalist?: string;
  journalist_url?: string;
  source_url?: string;
}
interface NewsData { irl: Item[]; dark: Item[]; tech: Item[]; }

const fallbackTicker = [
  "FBI warns of increased ransomware targeting healthcare",
  "Dark web market Nemesis reported offline — unknown cause",
  "IBM 1,000-qubit processor breaks gate fidelity record",
  "Europol seizes infrastructure in 14-nation cyber op",
  "LM Studio ships multi-model routing support",
  "New CVE disclosed in OpenSSH versions 8.x – 9.6",
];

function timeAgo(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso).getTime();
  if (isNaN(d)) return "";
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hr ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function News() {
  const [data, setData] = useState<NewsData>({ irl: [], dark: [], tech: [] });
  const [brief, setBrief] = useState<IntelBrief | null>(null);
  const [synthBusy, setSynthBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const { data: res } = await supabase.functions.invoke("vv-news");
        if (alive && res) setData({ irl: res.irl || [], dark: res.dark || [], tech: res.tech || [] });
      } catch {}
    }
    load();
    fetchLatestBrief().then(b => alive && b && setBrief(b));
    const id = setInterval(load, 5 * 60 * 1000);
    const bId = setInterval(() => fetchLatestBrief().then(b => alive && b && setBrief(b)), 15 * 60 * 1000);
    const unsub = subscribeToIntelBriefs(b => { if (alive) setBrief(b); });
    return () => { alive = false; clearInterval(id); clearInterval(bId); unsub(); };
  }, []);

  async function onSynthesize() {
    if (synthBusy) return;
    setSynthBusy(true);
    await triggerSynthesis();
    setTimeout(() => setSynthBusy(false), 90000);
    // refresh shortly after
    setTimeout(() => fetchLatestBrief().then(b => b && setBrief(b)), 5000);
  }

  // ticker: use signals if brief present
  const tickerSource = brief?.supporting_signals?.length
    ? brief.supporting_signals.map(s => `[${(s.ticker_impact || []).join("/") || "MKT"}] ${s.signal}`)
    : fallbackTicker;
  const doubled = [...tickerSource, ...tickerSource];

  return (
    <VVLayout>
      <div className="news-grid">
        <Column title="Live IRL News" tone="red" items={data.irl} badge="badge-red" badgeText="LIVE" />
        <Column title="Dark Web Intel" tone="gold" items={data.dark} badge="badge-dark" badgeText="ALERT" />
        <Column title="Tech Intelligence" tone="cyan" items={data.tech} badge="badge-tech" badgeText="NEW" />
        <IntelSynthesisColumn brief={brief} synthBusy={synthBusy} onSynthesize={onSynthesize} />
      </div>
      <div className="ticker-bar">
        <div className="ticker-label">// LIVE</div>
        <div className="ticker-track">
          <div className="ticker-inner">
            {doubled.map((t, i) => (
              <div key={i}><span>▸</span>{t}</div>
            ))}
          </div>
        </div>
      </div>
    </VVLayout>
  );
}

function Column({ title, tone, items, badge, badgeText }: {
  title: string; tone: "red" | "gold" | "cyan"; items: Item[]; badge: string; badgeText: string;
}) {
  return (
    <div className="news-col">
      <div className="col-header">
        <div className={`status-dot ${tone}`} />
        {title}
      </div>
      <div className="col-body">
        {items.length === 0 && <div className="news-item"><div className="news-title dim-text">Loading feed…</div></div>}
        {items.slice(0, 20).map((it, i) => {
          let sourceHref = it.source_url;
          if (!sourceHref && it.link) {
            try { sourceHref = new URL(it.link).origin; } catch {}
          }
          return (
            <div className="news-item" key={i}>
              {i === 0 && <span className={`badge ${badge}`}>{badgeText}</span>}
              <div className="news-title">
                {it.link ? (
                  <a href={it.link} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }}>
                    {it.title}
                  </a>
                ) : it.title}
              </div>
              <div className="news-meta" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {sourceHref ? (
                  <a href={sourceHref} target="_blank" rel="noopener noreferrer" className="news-source" style={{ color: "var(--gold)", textDecoration: "underline" }}>
                    {it.source || "Web"}
                  </a>
                ) : (
                  <span className="news-source">{it.source || "Web"}</span>
                )}
                {it.journalist && (
                  it.journalist_url ? (
                    <a href={it.journalist_url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--cyan)", textDecoration: "underline" }}>
                      ✎ {it.journalist}
                    </a>
                  ) : (
                    <span style={{ color: "var(--cyan)" }}>✎ {it.journalist}</span>
                  )
                )}
                <span style={{ marginLeft: "auto" }}>{timeAgo(it.time)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function IntelSynthesisColumn({ brief, synthBusy, onSynthesize }: {
  brief: IntelBrief | null; synthBusy: boolean; onSynthesize: () => void;
}) {
  return (
    <div className="news-col intel-column">
      <div className="col-header" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div className="status-dot gold" />
        <span>// VULTURE VISION INTEL</span>
        <span className="badge badge-gold" style={{ marginLeft: 4 }}>SYNTHESIZED</span>
        <button
          className="synthesize-btn"
          style={{ marginLeft: "auto" }}
          disabled={synthBusy}
          onClick={onSynthesize}
        >
          {synthBusy ? "SYNTHESIZING…" : "SYNTHESIZE NOW"}
        </button>
      </div>

      {!brief && !synthBusy && (
        <div className="news-item">
          <div className="news-title dim-text">AWAITING SYNTHESIS…</div>
          <div className="news-meta">Intel backend offline or no brief yet.</div>
        </div>
      )}

      {synthBusy && !brief && (
        <div className="synthesizing-placeholder">
          <div className="synth-spinner" />
          SYNTHESIZING...
        </div>
      )}

      {brief && (
        <>
          {/* Thesis */}
          <div className="intel-thesis-block">
            <div className="morning-brief-label" style={{ marginBottom: 6 }}>THESIS</div>
            <div className="intel-thesis-text">{brief.thesis}</div>
            <div className="intel-confidence-bar-wrap">
              <div className="intel-confidence-bar">
                <div className="intel-confidence-fill" style={{ width: `${brief.thesis_confidence}%` }} />
              </div>
              <span className={`badge ${brief.thesis_confidence >= 80 ? "badge-green" : brief.thesis_confidence >= 60 ? "badge-gold" : "badge-dim"}`}>
                {confidenceLabel(brief.thesis_confidence)}
              </span>
            </div>
            <div className="news-meta" style={{ marginTop: 6 }}>{timeAgoShort(brief.generated_at)} · {brief.cycle_type}</div>
          </div>

          {/* Supporting Signals */}
          <div className="morning-brief-label">SUPPORTING SIGNALS</div>
          {(brief.supporting_signals || []).slice(0, 5).map((s, i) => (
            <div key={i} className={`intel-signal-row ${dirClass(s.direction)}`}>
              <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                <span style={{ color: dirClass(s.direction) === "up" ? "var(--green)" : dirClass(s.direction) === "down" ? "var(--red)" : "var(--gold)" }}>
                  {dirArrow(s.direction)}
                </span>
                <span style={{ flex: 1 }}>{s.signal}</span>
              </div>
              <div className="news-meta" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--gold)", textDecoration: "underline" }}>
                    {s.source}
                  </a>
                ) : (
                  <span>{s.source}</span>
                )}
                {(s.ticker_impact || []).map(t => (
                  <span key={t} className="vv-ticker-tag dim">{t}</span>
                ))}
                {s.journalist_exclusive && <span className="badge badge-tech">EXCLUSIVE</span>}
              </div>
            </div>
          ))}

          {/* Alpha Alerts */}
          {(brief.alpha_alerts || []).length > 0 && (
            <>
              <div className="morning-brief-label" style={{ marginTop: 8 }}>ALPHA ALERTS</div>
              {brief.alpha_alerts.map((a, i) => (
                <div key={i} className={`alpha-alert ${a.urgency}`}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                    <span className={`badge ${a.urgency === "high" ? "badge-red" : a.urgency === "medium" ? "badge-gold" : "badge-dim"}`}>
                      {a.urgency === "high" ? "⚡ ALPHA" : a.urgency === "medium" ? "△ SIGNAL" : "○ NOTE"}
                    </span>
                    {a.source_journalist && <span style={{ color: "var(--cyan)", fontSize: 10 }}>✎ {a.source_journalist}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text)" }}>{a.alert}</div>
                  <div className="news-meta" style={{ marginTop: 4 }}>{a.why_it_matters}</div>
                </div>
              ))}
            </>
          )}

          {/* Regime Context */}
          {brief.regime_assessment && (
            <div className="transition-watch-box" style={{ marginTop: 8 }}>
              <div className="transition-watch-label">REGIME CONTEXT</div>
              <div className="transition-watch-text">{brief.regime_assessment.regime_summary}</div>
              {brief.regime_assessment.transition_watch && (
                <div className="news-meta" style={{ marginTop: 4 }}>↪ {brief.regime_assessment.transition_watch}</div>
              )}
            </div>
          )}

          {/* Ticker Implications */}
          {(brief.ticker_implications || []).length > 0 && (
            <>
              <div className="morning-brief-label" style={{ marginTop: 8 }}>TICKER IMPLICATIONS</div>
              <table className="data-table" style={{ fontSize: 10 }}>
                <thead><tr><th>TKR</th><th>DIR</th><th>HORIZON</th><th>CONF</th></tr></thead>
                <tbody>
                  {brief.ticker_implications.map((t, i) => (
                    <tr key={i}>
                      <td>{t.ticker}</td>
                      <td className={dirClass(t.direction)}>{dirArrow(t.direction)}</td>
                      <td>{t.time_horizon}</td>
                      <td>{t.confidence}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}
    </div>
  );
}
