import { useState } from "react";
import { runSyntheticCascade, type CascadeConfig, type CascadeResult } from "@/lib/research/cascade";

/**
 * Standalone research sandbox: uses no customer, real-person, network, or market data.
 * Button runs a deterministic on-device hypothetical cascade; no API calls.
 */
export function ResearchCascadePanel({ context }: { context: string }) {
  const [config, setConfig] = useState<CascadeConfig>({
    population: 200, steps: 12, seed: 17, initialSeeds: 3,
    contactsPerSharer: 3, shareProbability: 0.32,
    verificationProbability: 0.20, correctionProbability: 0.35,
  });
  const [result, setResult] = useState<CascadeResult | null>(null);
  const update = (key: keyof CascadeConfig, value: number) =>
    setConfig(prev => ({ ...prev, [key]: value }));
  return (
    <section className="rounded-md border border-white/20 bg-black/40 p-4 text-sm text-white" aria-label="Synthetic SocialSim-inspired cascade sandbox">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Information Cascade Research · {context}</h3>
          <p className="text-xs text-white/60">DARPA SocialSim/MACM research-inspired standalone toy model. No upstream engine installed.</p>
        </div>
        <span className="border border-white/30 px-2 py-1 text-[10px] tracking-wider">SYNTHETIC / UNVALIDATED</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <label className="text-xs">Population
          <input aria-label="Cascade population" className="mt-1 w-full rounded border border-white/30 bg-transparent px-2 py-1" type="number" min={2} max={2000} value={config.population} onChange={e => update("population", Number(e.target.value))}/>
        </label>
        <label className="text-xs">Steps
          <input aria-label="Cascade steps" className="mt-1 w-full rounded border border-white/30 bg-transparent px-2 py-1" type="number" min={1} max={100} value={config.steps} onChange={e => update("steps", Number(e.target.value))}/>
        </label>
        <label className="text-xs">Share probability
          <input aria-label="Cascade share probability" className="mt-1 w-full" type="range" min={0} max={1} step={0.05} value={config.shareProbability} onChange={e => update("shareProbability", Number(e.target.value))}/>
          <span className="font-mono">{Math.round(config.shareProbability * 100)}%</span>
        </label>
        <label className="text-xs">Verification probability
          <input aria-label="Cascade verification probability" className="mt-1 w-full" type="range" min={0} max={1} step={0.05} value={config.verificationProbability} onChange={e => update("verificationProbability", Number(e.target.value))}/>
          <span className="font-mono">{Math.round(config.verificationProbability * 100)}%</span>
        </label>
      </div>
      <button type="button" className="mt-3 rounded border border-white/40 px-3 py-1.5 text-xs hover:bg-white/10 disabled:opacity-40"
        disabled={!Number.isInteger(config.population) || config.population < config.initialSeeds || config.population > 2000 ||
          !Number.isInteger(config.steps) || config.steps < 1 || config.steps > 100}
        onClick={() => setResult(runSyntheticCascade(config))}>Run hypothetical cascade</button>
      {result && (
        <div role="status" className="mt-3 space-y-2 text-xs">
          <p>Reached: <strong>{result.reach}/{result.config.population}</strong> · Corrected: <strong>{result.corrected}</strong> · Seed {result.config.seed}</p>
          <div className="flex h-3 w-full overflow-hidden border border-white/30" role="img" aria-label="Final synthetic distribution">
            {(["unaware", "exposed", "sharing", "corrected"] as const).map((key, i) => (
              <div key={key} title={key} className={i % 2 === 0 ? "bg-white/70" : "bg-white/25"}
                style={{ width: (100 * result.timeline[result.timeline.length - 1][key] / result.config.population) + "%", borderRight: "1px solid #111" }} />
            ))}
          </div>
          <p className="text-white/60">Final states: {Object.entries(result.timeline[result.timeline.length - 1]).filter(([k]) => k !== "step").map(([k,v]) => k + " " + v).join(" · ")}</p>
          <p className="text-white/60">Illustrative mechanism only; not a prediction of real people, markets, or institutions. For source-verified forecasting, use calibrated and independently validated models.</p>
        </div>
      )}
    </section>
  );
}
