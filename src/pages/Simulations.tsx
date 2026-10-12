import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import CurrentScenarioInputs from '@/components/CurrentScenarioInputs';
import { DEFAULT_CAPITAL_INPUTS, buildCurrentSeed, buildEvaluationRequirement, requestCurrentBrief, type ScenarioBrief } from '@/lib/currentScenario';
import VVLayout from '@/components/VVLayout';
import corpus from '@/data/historicalCorpus.json';
import { buildSeed, checkAbort, engineCall, generateReport, prepareAndStart, type EngineState } from '@/lib/mirofishWorkflow';

export default function Simulations() {
  const [params] = useSearchParams();
  const articleIds = (params.get('articles') || '').split(',').filter(Boolean).slice(0,8);
  const [mode, setMode] = useState<'current' | 'historical'>('current');
  const [inputs, setInputs] = useState(DEFAULT_CAPITAL_INPUTS);
  const [brief, setBrief] = useState<ScenarioBrief | null>(null);
  const [synthBusy, setSynthBusy] = useState(false);
  const [selected, setSelected] = useState('');
  const [scenario, setScenario] = useState(params.get('scenario') || 'Compare the effects of current global events on liquidity, risk and the decisions I am considering.');
  const [rounds, setRounds] = useState(8);
  const [phase, setPhase] = useState('Ready to configure');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState('');
  const [runContext, setRunContext] = useState('');
  const [state, setState] = useState<EngineState | null>(null);
  const [health, setHealth] = useState<'checking' | 'available' | 'unavailable'>('checking');
  const run = useRef<AbortController | null>(null);
  const simulationId = useRef<string | null>(null);
  const mounted = useRef(true);
  const event = corpus.find(e => e.event_id === selected);
  useEffect(() => {
    mounted.current = true;
    engineCall('/health').then(() => { if (mounted.current) setHealth('available'); }).catch(() => { if (mounted.current) setHealth('unavailable'); });
    return () => { mounted.current = false; run.current?.abort(); };
  }, []);
  const stop = async () => {
    run.current?.abort();
    setPhase('Stopping monitoring');
    if (simulationId.current) {
      try { await engineCall('/api/simulation/stop', { simulation_id: simulationId.current }); setPhase('Engine stopped'); }
      catch { setError('Stop could not be confirmed. The server job may still be running.'); }
    } else setPhase('Monitoring stopped · preparation may continue on the server');
  };
  const synthesize = async () => {
    setSynthBusy(true); setError(''); setBrief(null);
    try { const next = await requestCurrentBrief(inputs, articleIds); if (mounted.current) setBrief(next); }
    catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : 'Synthesis failed'); }
    finally { if (mounted.current) setSynthBusy(false); }
  };
  const launch = async () => {
    const controller = new AbortController(); run.current = controller;
    simulationId.current = null;
    setBusy(true); setError(''); setState(null); setReport('');
    setRunContext(mode === 'current' && brief ? 'News snapshot: ' + new Date(brief.as_of).toLocaleString() : 'Historical-context run');
    const updatePhase = (p: string) => { if (mounted.current && !controller.signal.aborted) setPhase(p); };
    try {
      const seed = mode === 'current' ? buildCurrentSeed(scenario, brief!) : buildSeed(scenario, event);
      const requirement = mode === 'current' ? buildEvaluationRequirement(scenario, brief!) : scenario;
      const id = await prepareAndStart(requirement, seed, rounds, updatePhase, id => { simulationId.current = id; }, controller.signal);
      updatePhase('Swarm running');
      const deadline = Date.now() + 30 * 60 * 1000;
      while (!controller.signal.aborted && Date.now() < deadline) {
        const result = await engineCall('/api/simulation/' + encodeURIComponent(id) + '/run-status') as EngineState;
        checkAbort(controller.signal);
        if (mounted.current) setState(result);
        if (['completed', 'stopped', 'failed'].includes(result.runner_status)) {
          updatePhase(result.runner_status === 'completed' ? 'Simulation complete' : result.runner_status);
          if (result.runner_status === 'failed') throw new Error('Engine reported a failed simulation');
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      if (!controller.signal.aborted) throw new Error('Monitoring deadline exceeded; the server job may still be running.');
    } catch (e) {
      if (mounted.current && !controller.signal.aborted) { setError(e instanceof Error ? e.message : 'Simulation failed'); setPhase('Needs attention'); }
    } finally {
      if (controller.signal.aborted && simulationId.current) {
        try { await engineCall("/api/simulation/stop", { simulation_id: simulationId.current }); }
        catch { if (mounted.current) setError("Server stop could not be confirmed. The job may still be running."); }
      }
      if (mounted.current) setBusy(false);
    }
  };
  const requestReport = async () => {
    if (!simulationId.current) return;
    const controller = new AbortController(); run.current = controller; setBusy(true); setError('');
    try { const text = await generateReport(simulationId.current, p => { if (mounted.current && !controller.signal.aborted) setPhase(p); }, controller.signal); if (mounted.current && !controller.signal.aborted) { setReport(text); setPhase('Report ready'); } }
    catch (e) { if (mounted.current && !controller.signal.aborted) setError(e instanceof Error ? e.message : 'Report failed'); }
    finally { if (mounted.current) setBusy(false); }
  };
  return <VVLayout status={{ label: busy ? 'SIMULATION IN PROGRESS' : health === 'available' ? 'ENGINE AVAILABLE' : health === 'checking' ? 'CHECKING ENGINE' : 'ENGINE UNAVAILABLE', tone: busy ? 'gold' : health === 'available' ? 'green' : 'red' }}>
    <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs uppercase tracking-[.25em] text-primary">Research workspace</p><h1 className="mt-2 text-3xl font-semibold text-foreground">Scenario simulations</h1><p className="mt-3 max-w-2xl text-sm text-muted-foreground">Combine current global news or historical context with your inputs to compare conditional scenarios using MiroFish. Results describe simulated behavior and are not calibrated forecasts.</p></div>
        <span className="rounded-full border border-border px-3 py-1 text-xs">{corpus.length} historical scenarios</span>
      </div>
      {health === 'unavailable' && <div role="status" className="mb-6 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">The simulation service is unavailable or your account does not have pilot access. You can still explore the corpus and prepare a scenario.</div>}
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section className="space-y-5 rounded-2xl border border-border bg-background/90 p-6">
          <h2 className="text-lg font-semibold">Build a scenario</h2>
          <div className="flex gap-2"><button disabled={busy || synthBusy} className={'rounded-lg border px-4 py-2 text-sm ' + (mode === 'current' ? 'border-primary text-primary' : 'border-border')} onClick={() => setMode('current')}>Current events</button><button disabled={busy || synthBusy} className={'rounded-lg border px-4 py-2 text-sm ' + (mode === 'historical' ? 'border-primary text-primary' : 'border-border')} onClick={() => setMode('historical')}>Historical context</button></div>
          {mode === 'current' && <><CurrentScenarioInputs value={inputs} disabled={busy || synthBusy} onChange={v => { setInputs(v); setBrief(null); }}/>{articleIds.length > 0 && <p className="text-xs text-primary">{articleIds.length} selected news item(s) will be included alongside the global snapshot.</p>}<button disabled={busy || synthBusy || !inputs.objective.trim()} className="w-full rounded-lg border border-primary px-4 py-3 text-sm text-primary disabled:opacity-40" onClick={synthesize}>{synthBusy ? 'Gemini is synthesizing recent news…' : 'Synthesize current global events'}</button>
          {brief && <div className="rounded-xl border border-primary/30 p-4"><p className="text-xs text-primary">As of {new Date(brief.as_of).toLocaleString()} · {brief.coverage.articles} headlines · {brief.coverage.markets.length} markets</p><p className="mt-3 text-sm leading-relaxed">{brief.summary}</p><h3 className="mt-4 text-sm font-semibold">Suggested scenario inputs</h3><div className="mt-3 space-y-2">{brief.suggestions.map((suggestion,i) => <button key={i} disabled={busy || synthBusy} className="w-full rounded-lg border border-border p-3 text-left text-sm hover:border-primary" onClick={() => setScenario(suggestion.prompt)}>{suggestion.title}</button>)}</div><h3 className="mt-4 text-sm font-semibold">Options to compare</h3><ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">{brief.comparison_options.map((option,i) => <li key={i}>{option}</li>)}</ul><details className="mt-4 text-xs"><summary className="cursor-pointer text-primary">Sources and assumptions</summary><ul className="mt-3 space-y-2">{brief.news.map(n => <li key={n.id}><a className="underline" href={n.canonical_url} target="_blank" rel="noopener noreferrer">{n.source_country} · {n.source}: {n.title}</a></li>)}</ul><p className="mt-3">{brief.assumptions.join(' · ')}</p></details><p className="mt-4 text-xs text-muted-foreground">Refresh after 15 minutes or when your decision inputs change. Prices and portfolio valuations are not part of this headline snapshot.</p></div>}</>}
          {mode === 'historical' && <>

          <div><label htmlFor="historical-event" className="mb-2 block text-sm">Historical context</label><select id="historical-event" className="w-full rounded-lg border border-border bg-background p-3 text-sm" value={selected} disabled={busy} onChange={e => setSelected(e.target.value)}><option value="">Custom scenario · no historical context</option>{corpus.map(e => <option key={e.event_id} value={e.event_id}>{e.name} ({e.start_date})</option>)}</select></div>
          {event && <div className="rounded-xl border border-border p-4 text-sm"><div className="flex flex-wrap gap-2"><span className="text-primary">{event.category.replace(/_/g,' ')}</span><span className="text-muted-foreground">{event.region} · {event.asset_class}</span></div><p className="mt-3">{event.trigger}</p><p className="mt-3 text-muted-foreground">Transmission: {event.contagion_channels}</p><p className="mt-3 text-xs text-primary">Unverified historical context · qualitative use only. Outcomes and subsequent policy responses are withheld from the seed.</p></div>}
          </>}
          <div><label htmlFor="scenario" className="mb-2 block text-sm">What should the swarm explore?</label><textarea id="scenario" rows={5} maxLength={4000} className="w-full rounded-lg border border-border bg-background p-3 text-sm leading-relaxed" value={scenario} onChange={e => setScenario(e.target.value)} disabled={busy || synthBusy}/></div>
          <div><label htmlFor="rounds" className="mb-2 block text-sm">Rounds · {rounds}</label><input id="rounds" className="w-full accent-yellow-500" type="range" min={1} max={24} value={rounds} disabled={busy} onChange={e => setRounds(Number(e.target.value))}/><p className="mt-2 text-xs text-muted-foreground">Agent count is generated from the memory graph. More rounds increase API usage.</p></div>
          <button className="w-full rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground disabled:opacity-40" disabled={busy || synthBusy || health !== 'available' || !scenario.trim() || (mode === 'current' && !brief)} onClick={launch}>Start simulation</button>
          {busy && <button className="w-full rounded-lg border border-border px-4 py-3 text-sm" onClick={stop}>Stop run</button>}
          {error && <p role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">{error}</p>}
        </section>
        <section className="rounded-2xl border border-border bg-background/90 p-6" aria-live="polite">
          <h2 className="text-lg font-semibold">Run activity</h2>{runContext && <p className="mt-2 text-xs text-muted-foreground">{runContext}</p>}<p className="mt-4 text-primary">{phase}</p>
          <ol className="mt-6 space-y-4 text-sm text-muted-foreground"><li>1. Extract entities from the seed document</li><li>2. Build the Zep memory graph</li><li>3. Generate agent profiles and configuration</li><li>4. Run simulated social interactions</li></ol>
          {state && <div className="mt-8 space-y-4"><progress className="h-2 w-full accent-yellow-500" max={100} value={Math.max(0,Math.min(100,state.progress_percent || 0))}/><div className="grid grid-cols-2 gap-3"><div className="rounded-lg border border-border p-4"><p className="text-xs text-muted-foreground">Round</p><p className="mt-2 text-xl">{state.current_round} / {state.total_rounds}</p></div><div className="rounded-lg border border-border p-4"><p className="text-xs text-muted-foreground">Agent actions</p><p className="mt-2 text-xl">{state.total_actions_count}</p></div></div><p className="text-xs text-muted-foreground">These are engine counters. Sentiment and market probabilities are not inferred from action counts.</p></div>}
          {state?.runner_status === 'completed' && !report && <button disabled={busy} onClick={requestReport} className="mt-6 rounded-lg border border-primary px-4 py-3 text-sm text-primary disabled:opacity-40">Generate analysis report · uses additional API calls</button>}
          {report && <article className="mt-6 whitespace-pre-wrap break-words rounded-xl border border-border p-4 text-sm leading-relaxed"><h3 className="mb-3 font-semibold">Exploratory simulation report</h3>{report}</article>}
          <div className="mt-8 border-t border-border pt-5 text-xs leading-relaxed text-muted-foreground">Historical replays can be influenced by a model's prior knowledge. Corpus magnitude estimates remain unverified. Use runs to explore hypotheses; measure predictive performance separately against unseen outcomes.</div>
        </section>
      </div>
    </main>
  </VVLayout>;
}
