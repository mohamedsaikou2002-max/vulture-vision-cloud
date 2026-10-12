import { useEffect, useRef, useState } from 'react';
import VVLayout from '@/components/VVLayout';
import corpus from '@/data/historicalCorpus.json';
import { buildSeed, checkAbort, engineCall, generateReport, prepareAndStart, type EngineState } from '@/lib/mirofishWorkflow';

export default function Simulations() {
  const [selected, setSelected] = useState('');
  const [scenario, setScenario] = useState('A major bank announces unexpected losses. Explore deposit withdrawals, liquidity stress and the spread of market narratives.');
  const [rounds, setRounds] = useState(8);
  const [phase, setPhase] = useState('Ready to configure');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState('');
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
  const launch = async () => {
    const controller = new AbortController(); run.current = controller;
    simulationId.current = null;
    setBusy(true); setError(''); setState(null); setReport('');
    const updatePhase = (p: string) => { if (mounted.current && !controller.signal.aborted) setPhase(p); };
    try {
      const id = await prepareAndStart(scenario, buildSeed(scenario, event), rounds, updatePhase, id => { simulationId.current = id; }, controller.signal);
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
        <div><p className="text-xs uppercase tracking-[.25em] text-primary">Research workspace</p><h1 className="mt-2 text-3xl font-semibold text-foreground">Scenario simulations</h1><p className="mt-3 max-w-2xl text-sm text-muted-foreground">Explore how agents react to a financial shock using MiroFish. Results describe simulated behavior and are not calibrated forecasts.</p></div>
        <span className="rounded-full border border-border px-3 py-1 text-xs">{corpus.length} historical scenarios</span>
      </div>
      {health === 'unavailable' && <div role="status" className="mb-6 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">The simulation service is unavailable or your account does not have pilot access. You can still explore the corpus and prepare a scenario.</div>}
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section className="space-y-5 rounded-2xl border border-border bg-background/90 p-6">
          <h2 className="text-lg font-semibold">Build a scenario</h2>
          <div><label htmlFor="historical-event" className="mb-2 block text-sm">Historical context</label><select id="historical-event" className="w-full rounded-lg border border-border bg-background p-3 text-sm" value={selected} disabled={busy} onChange={e => setSelected(e.target.value)}><option value="">Custom scenario · no historical context</option>{corpus.map(e => <option key={e.event_id} value={e.event_id}>{e.name} ({e.start_date})</option>)}</select></div>
          {event && <div className="rounded-xl border border-border p-4 text-sm"><div className="flex flex-wrap gap-2"><span className="text-primary">{event.category.replace(/_/g,' ')}</span><span className="text-muted-foreground">{event.region} · {event.asset_class}</span></div><p className="mt-3">{event.trigger}</p><p className="mt-3 text-muted-foreground">Transmission: {event.contagion_channels}</p><p className="mt-3 text-xs text-primary">Unverified historical context · qualitative use only. Outcomes and subsequent policy responses are withheld from the seed.</p></div>}
          <div><label htmlFor="scenario" className="mb-2 block text-sm">What should the swarm explore?</label><textarea id="scenario" rows={5} maxLength={4000} className="w-full rounded-lg border border-border bg-background p-3 text-sm leading-relaxed" value={scenario} onChange={e => setScenario(e.target.value)} disabled={busy}/></div>
          <div><label htmlFor="rounds" className="mb-2 block text-sm">Rounds · {rounds}</label><input id="rounds" className="w-full accent-yellow-500" type="range" min={1} max={24} value={rounds} disabled={busy} onChange={e => setRounds(Number(e.target.value))}/><p className="mt-2 text-xs text-muted-foreground">Agent count is generated from the memory graph. More rounds increase API usage.</p></div>
          <button className="w-full rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground disabled:opacity-40" disabled={busy || health !== 'available' || !scenario.trim()} onClick={launch}>Start simulation</button>
          {busy && <button className="w-full rounded-lg border border-border px-4 py-3 text-sm" onClick={stop}>Stop run</button>}
          {error && <p role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">{error}</p>}
        </section>
        <section className="rounded-2xl border border-border bg-background/90 p-6" aria-live="polite">
          <h2 className="text-lg font-semibold">Run activity</h2><p className="mt-4 text-primary">{phase}</p>
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
