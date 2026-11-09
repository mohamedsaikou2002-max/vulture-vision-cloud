import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import VVLayout from '@/components/VVLayout';
import { ApiError, jobStatus, loadJob, runSimulation, type AutoSimResult } from '@/lib/autoSimApi';
import { pct } from '@/lib/autosimFormat';
import '@/styles/simulator.css';

const EXAMPLES = [
  'What happens to Nasdaq if the Fed raises interest rates unexpectedly?',
  'How could a sudden inflation increase affect Nasdaq valuations?',
  'What happens if liquidity tightens across technology markets?',
];

type RiskProfile = 'conservative' | 'balanced' | 'aggressive';

export default function SimpleSimulator() {
  const [scenario, setScenario] = useState('');
  const [horizon, setHorizon] = useState(7);
  const [risk, setRisk] = useState<RiskProfile>('conservative');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<AutoSimResult | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const active = useRef(false);
  const payload = useRef<Parameters<typeof runSimulation>[0] | null>(null);

  const run = async () => {
    if (active.current) return;
    active.current = true;
    setBusy(true);
    setError('');
    try {
      if (pending) {
        const state = await jobStatus(pending);
        if (state === 'completed') {
          const value = await loadJob(pending);
          if (value) { setResult(value); setPending(null); return; }
        }
        if (state === null && payload.current?.job_id === pending) {
          const response = await runSimulation(payload.current);
          setResult(response.result);
          setPending(null);
          return;
        }
        if (state === 'failed' || state === 'cancelled') {
          setPending(null);
          throw new Error('The previous run failed. You can start again.');
        }
        throw new Error('Your previous run is still unconfirmed. Check again before starting another.');
      }

      if (scenario.trim().length < 8) {
        throw new Error('Describe a market scenario in at least a few words.');
      }
      setResult(null);
      const id = crypto.randomUUID();
      payload.current = {
        job_id: id,
        scenario: scenario.trim(),
        constraints: { horizon_days: horizon, risk_profile: risk },
      };
      try {
        const response = await runSimulation(payload.current);
        setResult(response.result);
      } catch (e) {
        // Preserve the atomic job ID if a response was lost, to avoid a duplicate paid run.
        if (!(e instanceof ApiError) || e.status === 0 || e.status >= 500 ||
            ['empty_response', 'invalid_json', 'invalid_response'].includes(e.code)) {
          setPending(id);
        }
        throw e;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Simulation unavailable');
    } finally {
      active.current = false;
      setBusy(false);
    }
  };

  const returns = result?.strategies.buy_hold_scenario;
  return (
    <VVLayout>
      <main className="simple-sim">
        <header className="simple-sim-header">
          <span className="room-eyebrow">VULTURE VISION / QUICK SIMULATION</span>
          <h1>Explore a market scenario</h1>
          <p>Describe a possible event, choose your assumptions, and review simulated Nasdaq outcomes in one place.</p>
        </header>

        <div className="simple-workspace">
          <section className="simple-panel simple-input-panel" aria-labelledby="simple-input-title">
            <div className="simple-panel-kicker">01 / INPUT</div>
            <h2 id="simple-input-title">Build your scenario</h2>
            <form onSubmit={e => { e.preventDefault(); void run(); }}>
              <label htmlFor="simple-scenario">What happens?</label>
              <textarea
                id="simple-scenario"
                value={scenario}
                onChange={e => setScenario(e.target.value)}
                minLength={8}
                maxLength={2000}
                disabled={busy || !!pending}
                placeholder="Example: Inflation rises while the Fed keeps rates elevated..."
              />
              <div className="simple-settings">
                <label htmlFor="simple-horizon">Time horizon
                  <select id="simple-horizon" value={horizon} disabled={busy || !!pending} onChange={e => setHorizon(Number(e.target.value))}>
                    <option value={7}>7 days</option>
                    <option value={14}>14 days</option>
                    <option value={30}>30 days</option>
                  </select>
                </label>
                <label htmlFor="simple-risk">Risk assumptions
                  <select id="simple-risk" value={risk} disabled={busy || !!pending} onChange={e => setRisk(e.target.value as RiskProfile)}>
                    <option value="conservative">Conservative</option>
                    <option value="balanced">Balanced</option>
                    <option value="aggressive">Aggressive</option>
                  </select>
                </label>
              </div>
              <button className="simple-submit" disabled={busy || (!pending && scenario.trim().length < 8)} type="submit">
                {busy ? 'Analyzing scenario…' : pending ? 'Check pending run' : 'Run simulation'}
              </button>
              <p className="simple-helper">Uses the existing Nasdaq simulation engine. No separate synthetic research experiment is required.</p>
            </form>
            <div className="simple-presets" aria-label="Example scenarios">
              <span>TRY AN EXAMPLE</span>
              {EXAMPLES.map(example => (
                <button key={example} type="button" disabled={busy || !!pending} onClick={() => setScenario(example)}>
                  {example}
                </button>
              ))}
            </div>
            {error && <p className="simple-error" role="alert">{error}</p>}
            <p className="simple-helper">Your scenario history is attached to your account when the backend is configured.</p>
          </section>

          <section className="simple-panel simple-output-panel" aria-labelledby="simple-output-title" aria-live="polite">
            <div className="simple-panel-kicker">02 / OUTPUT</div>
            <h2 id="simple-output-title">Simulation results</h2>
            {busy && <p className="simple-progress" role="status">Analyzing the event and calculating scenario ranges…</p>}
            {result ? (
              <div className="simple-results">
                <h3>{result.analysis?.headline || 'Simulated Nasdaq outcomes'}</h3>
                <p className="simple-result-scenario">{result.scenario}</p>
                <div className="simple-cards">
                  {([
                    ['Lower range', returns?.p5_return],
                    ['Middle range', returns?.median_return],
                    ['Upper range', returns?.p95_return],
                  ] as const).map(([name, value]) => (
                    <article key={name}><span>{name}</span><strong>{pct(value, 1)}</strong></article>
                  ))}
                </div>
                <p className="simple-analysis">{result.analysis?.summary}</p>
                {result.warnings.length > 0 && (
                  <details className="simple-assumptions">
                    <summary>Data limits and assumptions</summary>
                    {result.warnings.map((warning, i) => <p key={i}>{warning}</p>)}
                  </details>
                )}
                <small>Scenario-based estimated return ranges, not guaranteed forecasts. Source freshness and missing observations may affect the result.</small>
              </div>
            ) : (
              <div className="simple-empty">
                <span aria-hidden="true">▥</span>
                <h3>{busy ? 'Simulation in progress' : 'Ready for your scenario'}</h3>
                <p>{busy ? 'Your report will appear when the model responds.' : 'Enter a scenario on the left and run the analysis. Downside, central, and upside return ranges will appear here.'}</p>
              </div>
            )}
            <Link className="simple-advanced-link" to="/simulations">Advanced simulation workspace</Link>
          </section>
        </div>
      </main>
    </VVLayout>
  );
}
