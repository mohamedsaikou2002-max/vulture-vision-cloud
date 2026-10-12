import { useState } from 'react';
import { Link } from 'react-router-dom';
import { DEFAULT_CAPITAL_INPUTS, requestCurrentBrief, type ScenarioBrief } from '@/lib/currentScenario';
export default function NewsScenarioSuggestions() {
  const [brief, setBrief] = useState<ScenarioBrief | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const load = async () => {
    setBusy(true); setError('');
    try { setBrief(await requestCurrentBrief(DEFAULT_CAPITAL_INPUTS)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Suggestions unavailable'); }
    finally { setBusy(false); }
  };
  return <section className="mx-4 my-6 rounded-xl border border-border bg-background/90 p-5 md:mx-8">
    <div className="flex flex-wrap justify-between gap-4"><div><h2 className="text-lg font-semibold">Plug news into a simulation</h2><p className="mt-1 text-sm text-muted-foreground">Browse current-event scenario ideas, then add your objective and decision context.</p></div><button disabled={busy} onClick={load} className="rounded-lg border border-primary px-4 py-2 text-sm text-primary disabled:opacity-40">{busy ? 'Synthesizing recent news…' : 'Suggest scenarios from global news'}</button></div>
    {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
    {brief && <><p className="mt-4 text-xs text-muted-foreground">Snapshot {new Date(brief.as_of).toLocaleString()} · {brief.coverage.articles} headlines · {brief.coverage.markets.length} markets represented</p><div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{brief.suggestions.map((s,i) => <article className="rounded-lg border border-border p-4" key={i}><h3 className="font-semibold">{s.title}</h3><p className="mt-3 text-sm text-muted-foreground">{s.prompt}</p><div className="mt-3 flex flex-wrap gap-2">{s.source_ids.map(id => { const n=brief.news.find(n => n.id===id); return n ? <a key={id} href={n.canonical_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">{n.source} · {n.source_country}</a> : null; })}</div><Link className="mt-4 inline-block rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground" to={'/simulations?' + new URLSearchParams({ scenario:s.prompt, articles:s.source_ids.join(',') })}>Use this scenario</Link></article>)}</div></>}
  </section>;
}
