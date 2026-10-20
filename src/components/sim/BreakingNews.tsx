import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

// Mirrors the breaking-news terms used by the vv-news backend so the simulator
// surfaces the same urgent headlines the news feed banners.
const BREAKING_TERMS = ["breaking", "urgent", "just in", "developing", "alert:", "live:", "flash:"];

interface BreakingRow { id: string; title: string; source: string; published_at: string | null; }

export default function BreakingNews() {
  const [items, setItems] = useState<BreakingRow[]>([]);
  useEffect(() => {
    let active = true, running = false;
    const load = async () => {
      if (running) return; running = true;
      try {
        const since = new Date(Date.now() - 6 * 3600000).toISOString();
        const { data, error } = await supabase.from('news_articles')
          .select('id,title,source,published_at')
          .gte('fetched_at', since)
          .order('published_at', { ascending: false, nullsFirst: false })
          .limit(60).abortSignal(AbortSignal.timeout(8000));
        if (!active) return;
        if (error) { setItems([]); return; }
        const matches = (data || []).filter(n => {
          const t = (n.title || '').toLowerCase();
          const published = n.published_at ? Date.parse(n.published_at) : NaN;
          const fresh = !Number.isFinite(published) || published <= Date.now() + 300000;
          return fresh && BREAKING_TERMS.some(term => t.includes(term));
        }).slice(0, 5);
        setItems(matches);
      } catch { if (active) setItems([]); }
      finally { running = false; }
    };
    void load();
    const timer = setInterval(() => void load(), 60000);
    const channel = supabase.channel('sim-breaking-news').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'news_articles' }, () => void load()).subscribe();
    return () => { active = false; clearInterval(timer); void supabase.removeChannel(channel); };
  }, []);
  if (!items.length) return null;
  return <section className="panel sim-card" aria-label="Breaking news">
    <h2 className="panel-title">⚡ Breaking now</h2>
    <p className="sim-fine">Urgent headlines from the backend index. Select one to stress-test it.</p>
    <ul className="sim-news">{items.map(n => <li key={n.id}>
      <Link to={'/simulations?' + new URLSearchParams({ scenario: 'Explore the consequences of: ' + n.title, articles: n.id })}>{n.title}</Link>
      <p>{n.source} · {n.published_at ? new Date(n.published_at).toLocaleString() : ''}</p>
    </li>)}</ul>
  </section>;
}
