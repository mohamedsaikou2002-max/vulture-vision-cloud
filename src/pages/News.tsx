import { useEffect, useState } from "react";
import VVLayout from "@/components/VVLayout";
import { supabase } from "@/integrations/supabase/client";

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

const tickerItems = [
  "FBI warns of increased ransomware targeting healthcare",
  "Dark web market Nemesis reported offline — unknown cause",
  "IBM 1,000-qubit processor breaks gate fidelity record",
  "Europol seizes infrastructure in 14-nation cyber op",
  "LM Studio ships multi-model routing support",
  "New CVE disclosed in OpenSSH versions 8.x – 9.6",
  "DarkOwl flags new credential stuffing kit targeting banking",
  "CISA adds 3 new exploited vulnerabilities to KEV catalog",
  "Anthropic extended thinking API now in public beta",
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

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const { data: res } = await supabase.functions.invoke("vv-news");
        if (alive && res) setData({ irl: res.irl || [], dark: res.dark || [], tech: res.tech || [] });
      } catch {}
    }
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const doubled = [...tickerItems, ...tickerItems];

  return (
    <VVLayout>
      <div className="news-grid">
        <Column title="Live IRL News" tone="red"  items={data.irl}  badge="badge-red"  badgeText="LIVE" />
        <Column title="Dark Web Intel" tone="gold" items={data.dark} badge="badge-dark" badgeText="ALERT" />
        <Column title="Tech Intelligence" tone="cyan" items={data.tech} badge="badge-tech" badgeText="NEW" />
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
        {items.slice(0, 20).map((it, i) => (
          <div className="news-item" key={i}>
            {i === 0 && <span className={`badge ${badge}`}>{badgeText}</span>}
            <div className="news-title">{it.title}</div>
            <div className="news-meta">
              <span className="news-source">{it.source || "Web"}</span>
              <span>{timeAgo(it.time)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
