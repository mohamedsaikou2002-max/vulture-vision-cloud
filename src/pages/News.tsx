import { Link } from "react-router-dom";
import newsSources from "@/data/newsSources.json";
import { useEffect, useRef, useState } from "react";
import { functionError } from "@/lib/functionError";
import VVLayout from "@/components/VVLayout";
import marketRegistry from "@/data/newsMarkets.json";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchLatestBrief, subscribeToIntelBriefs, triggerSynthesis,
  IntelBrief, dirArrow, dirClass, confidenceLabel, timeAgoShort,
} from "@/lib/intelApi";

interface Item {
  id?: string;
  source_country?: string;
  language?: string;
  fetched_at?: string;
  title: string;
  source?: string;
  time?: string;
  link?: string;
  journalist?: string;
  journalist_url?: string;
  source_url?: string;
}
interface NewsData { irl: Item[]; dark: Item[]; tech: Item[]; }


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
  const [collector,setCollector]=useState<Record<string,{status:string;checked_at:string;articles:number}>>({});
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [moreBusy, setMoreBusy] = useState(false);
  const [country, setCountry] = useState("");
  const filterRef=useRef(country);filterRef.current=country;
  const pageRef=useRef(0);
  const lastLiveRefresh=useRef(0);
  const loadedCountry=useRef<string|null>(null);
  const [publisherItems, setPublisherItems] = useState<Item[]>([]);
  const [publisherStatus, setPublisherStatus] = useState("loading");
  const [data, setData] = useState<NewsData>({ irl: [], dark: [], tech: [] });
  const [breaking, setBreaking] = useState<Item[]>([]);
  const [brief, setBrief] = useState<IntelBrief | null>(null);
  const [synthBusy, setSynthBusy] = useState(false);
  const [feedStatus, setFeedStatus] = useState('loading');
  const [refresh, setRefresh] = useState(0);
  const [synthesisNotice, setSynthesisNotice] = useState<string | null>(null);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [sourceHealth, setSourceHealth] = useState<{source: string; status: string; count: number}[]>([]);

  useEffect(() => {
    let alive = true;
    let loading=false;
    async function load() {
      if(loading)return;loading=true;
      try {
        const { data: res, error } = await supabase.functions.invoke("vv-news", { body: { country } });
        if (error) {
          const explanation = await functionError(error, "News sources are unavailable. Please try again shortly.");
          const failure = await error.context?.clone?.().json().catch(() => null);
          if (alive) {
            setPublisherStatus("ingestion_not_available"); setFeedStatus('unavailable'); setFeedError(explanation);
            setSourceHealth(Array.isArray(failure?.source_health) ? failure.source_health.filter((s: {source?:unknown;status?:unknown;count?:unknown}) => typeof s.source === 'string' && typeof s.status === 'string' && typeof s.count === 'number') : []);
          }
          return;
        }
        if (alive && res) {
          setFeedStatus(res.status || "degraded"); setFeedError(res.error || null); setSourceHealth(res.source_health || []);
          setData({ irl: res.irl || [], dark: res.dark || [], tech: res.tech || [] });
          setBreaking(Array.isArray(res.breaking) ? res.breaking : []);
          setPublisherItems(old=>[...new Map([...(res.publisher_news || []),...old].map(it=>[it.id||it.link,it])).values()]); if(pageRef.current===0)setHasMore(!!res.has_more);
          setPublisherStatus(res.publisher_status || "ingestion_not_available");
        }
      } catch { if (alive) { setPublisherStatus("ingestion_not_available"); setFeedStatus("unavailable"); setFeedError("News sources are unavailable."); } }
      finally{loading=false;}
    }
    if(loadedCountry.current!==country){setPublisherItems([]);setPage(0);pageRef.current=0;loadedCountry.current=country;}
    setPublisherStatus("loading");setFeedStatus("loading");
    load();
    void supabase.from('news_source_status').select('source_id,status,checked_at,articles').abortSignal(AbortSignal.timeout(8000)).then(({data})=>{if(alive&&data)setCollector(Object.fromEntries(data.map(s=>[s.source_id,s])));});
    fetchLatestBrief().then(b => alive && b && setBrief(b));
    const id = setInterval(load, 60000);
    const channel = supabase.channel("news-feed-updates").on("postgres_changes", {event:"INSERT",schema:"public",table:"news_articles"}, () => { if (alive && Date.now()-lastLiveRefresh.current>15000){lastLiveRefresh.current=Date.now();setRefresh(n=>n+1);} }).subscribe();
    const bId = setInterval(() => fetchLatestBrief().then(b => alive && b && setBrief(b)), 15 * 60 * 1000);
    const unsub = subscribeToIntelBriefs(b => { if (alive) setBrief(b); });
    return () => { alive = false; void supabase.removeChannel(channel); clearInterval(id); clearInterval(bId); unsub(); };
  }, [country, refresh]);

  async function loadMore() {
    if (moreBusy) return;
    setMoreBusy(true);
    try {
      const {data:res,error}=await supabase.functions.invoke('vv-news',{body:{country,page:page+1,publisher_only:true}});
      if(filterRef.current!==country)return;
      if(error)throw error;
      if(res.publisher_status !== 'available' && res.publisher_status !== 'no_recent_articles')throw new Error();
      setPublisherItems(old=>[...new Map([...old,...res.publisher_news].map(it=>[it.id||it.link,it])).values()]);
      pageRef.current=page+1;setPage(n=>n+1);setHasMore(!!res.has_more);
    } catch { setFeedError('Could not load the next page. Your current headlines are retained.'); }
    finally {setMoreBusy(false);}
  }

  async function onSynthesize() {
    if (synthBusy) return;
    setSynthBusy(true);
    setSynthesisNotice(null);
    try {
      const result = await triggerSynthesis();
      if (!result) { setSynthesisNotice("The intelligence service is unavailable. Synthesis was not confirmed."); return; }
      const updated = await fetchLatestBrief();
      if (updated) setBrief(updated);
      setSynthesisNotice("Synthesis requested. Only verified brief updates are displayed.");
    } finally { setSynthBusy(false); }
  }

  // ticker: use signals if brief present
  const tickerSource = brief?.supporting_signals?.length
    ? brief.supporting_signals.map(s => `[${(s.ticker_impact || []).join("/") || "MKT"}] ${s.signal}`)
    : ["No current synthesized signals available."];
  const doubled = [...tickerSource, ...tickerSource];

  return (
    <VVLayout status={{ label: feedStatus === 'loading' ? 'CHECKING NEWS' : feedStatus === 'available' ? 'NEWS AVAILABLE' : feedStatus === 'degraded' ? 'PARTIAL NEWS COVERAGE' : 'NEWS UNAVAILABLE', tone: feedStatus === 'available' ? 'green' : 'gold' }}>
      <div className="service-notice" role="status">
        {feedError || (feedStatus === 'loading' ? 'Checking news sources…' : feedStatus === 'degraded' ? 'Some news sources are unavailable. Coverage is incomplete.' : feedStatus === 'available' ? 'News source checks completed.' : 'News is unavailable.')}
        <button className="synthesize-btn" onClick={() => setRefresh(n => n + 1)}>Refresh news</button>
        {synthesisNotice && <p>{synthesisNotice}</p>}
        {sourceHealth.length > 0 && <details className="source-health"><summary>{sourceHealth.filter(s => s.status === 'available' || s.status === 'empty').length} of {sourceHealth.length} sources responded — view source status</summary><ul>{sourceHealth.map((s, i) => <li key={i}>{s.source}: {s.status.replace(/_/g, ' ')} ({s.count} items)</li>)}</ul></details>}
      </div>
      <section className="mx-4 my-6 rounded-xl border border-border bg-background/90 p-5 md:mx-8">
        <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-lg font-semibold">Global publisher desk</h2><p className="mt-1 text-xs text-muted-foreground">207 additional publishers across {new Set(newsSources.map(s=>s.source_country)).size} markets · country tags identify the publisher, not the subject of the story.</p></div><div><label htmlFor="news-country" className="sr-only">Publisher country or market</label><select id="news-country" value={country} onChange={e => setCountry(e.target.value)} className="rounded-lg border border-border bg-background p-2 text-sm"><option value="">All markets</option>{[...new Map([...marketRegistry,...newsSources.map(s=>({code:s.source_country,name:s.country_name}))].map(m=>[m.code,m])).values()].sort((a,b)=>a.name.localeCompare(b.name)).map(m => <option key={m.code} value={m.code}>{m.name}</option>)}</select></div></div>
        {publisherItems.length ? <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">{publisherItems.map(it => <article key={it.link} className="rounded-lg border border-border p-4 hover:border-primary"><p className="mb-2 text-xs text-primary">{it.source_country} · {it.source} · {it.language}</p><a href={it.link} target="_blank" rel="noopener noreferrer" className="text-sm leading-relaxed hover:underline">{decodeEntities(it.title)}</a><p className="mt-3 text-xs text-muted-foreground">{it.time ? timeAgo(it.time) : "Publication time unavailable"}</p>{it.id && <Link className="mt-3 inline-block text-xs text-primary underline" to={"/simulations?"+new URLSearchParams({scenario:"Explore the consequences of: "+it.title,articles:it.id})}>Explore in simulator</Link>}</article>)}</div> : <p role="status" className="mt-5 text-sm text-muted-foreground">{publisherStatus === "loading" ? "Loading publisher headlines…" : publisherStatus === "no_recent_articles" ? "No recent publisher headlines for this market." : "Publisher ingestion is not available yet."}</p>}
        {hasMore && <button className="synthesize-btn" disabled={moreBusy} onClick={()=>void loadMore()}>{moreBusy?'Loading…':'Load more headlines'}</button>}
        <details className="mt-4 text-xs"><summary>207-source catalog and collection status</summary><p>Collected metadata appears above. Restricted or unreachable publishers are skipped; no feed can guarantee all news. Headlines are ordered by publication time and refresh every minute.</p><ul>{newsSources.map(s=><li key={s.id}>{s.name} · {s.country_name} · {collector[s.id] ? `${collector[s.id].status} (${collector[s.id].articles} items) · ${new Date(collector[s.id].checked_at).toLocaleString()}` : "No collector report yet"}</li>)}</ul></details>
      </section>
      {breaking.length > 0 && <section className="mx-4 mb-2 rounded-xl border border-destructive/50 bg-destructive/10 p-4 md:mx-8" aria-label="Breaking news">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[.2em] text-destructive">⚡ Breaking now</p>
        <ul className="space-y-2">{breaking.map((it, i) => <li key={i} className="text-sm leading-relaxed">
          {it.link ? <a href={it.link} target="_blank" rel="noopener noreferrer" className="hover:underline">{decodeEntities(it.title)}</a> : decodeEntities(it.title)}
          <span className="ml-2 text-xs text-muted-foreground">{it.source || "Web"} · {it.time ? timeAgo(it.time) : "just now"}</span>
        </li>)}</ul>
      </section>}
      <div className="news-grid">
        <Column title="IRL News" tone="red" items={data.irl} badge="badge-red" badgeText="FEED" unavailable={feedStatus === "unavailable"} />
        <Column title="Dark Web Intel" tone="gold" items={data.dark} badge="badge-dark" badgeText="ALERT" unavailable={feedStatus === "unavailable"} />
        <Column title="Tech Intelligence" tone="cyan" items={data.tech} badge="badge-tech" badgeText="NEW" unavailable={feedStatus === "unavailable"} />
        <IntelSynthesisColumn brief={brief} synthBusy={synthBusy} onSynthesize={onSynthesize} />
      </div>
      <div className="ticker-bar">
        <div className="ticker-label">// SIGNALS</div>
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

function Column({ title, tone, items, badge, badgeText, unavailable }: {
  title: string; tone: "red" | "gold" | "cyan"; items: Item[]; badge: string; badgeText: string; unavailable: boolean;
}) {
  const [visible,setVisible]=useState(20);
  return (
    <div className="news-col">
      <div className="col-header">
        <div className={`status-dot ${tone}`} />
        {title}
      </div>
      <div className="col-body">
        {items.length === 0 && <div className="news-item"><div className="news-title dim-text">{unavailable ? "Source connection unavailable. Headlines could not be refreshed." : "No feed items available."}</div></div>}
        {items.slice(0, visible).map((it, i) => {
          let sourceHref = it.source_url;
          if (!sourceHref && it.link) {
            try { sourceHref = new URL(it.link).origin; } catch { sourceHref = undefined; }
          }
          return (
            <div className="news-item" key={i}>
              {i === 0 && <span className={`badge ${badge}`}>{badgeText}</span>}
              <div className="news-title">
                {it.link ? (
                  <a href={it.link} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }}>
                    {decodeEntities(it.title)}
                  </a>
                ) : decodeEntities(it.title)}
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
                <span style={{ marginLeft: "auto" }}>{it.time ? timeAgo(it.time) : "Publication time unknown"}</span>
              </div>
            </div>
          );
        })}
        {visible<items.length && <button className="synthesize-btn" onClick={()=>setVisible(n=>n+20)}>Show more headlines ({items.length-visible} remaining)</button>}
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

function decodeEntities(s: string = ""): string {
  const map: Record<string, string> = { amp: "&", apos: "'", quot: '"', lt: "<", gt: ">", nbsp: " " };
  return s.replace(/&(?:amp;)?(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") { const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m; }
    return map[e.toLowerCase()] ?? m;
  });
}
