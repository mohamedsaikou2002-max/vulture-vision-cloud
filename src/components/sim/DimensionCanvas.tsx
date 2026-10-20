import { Button } from "@/components/ui/button";
import { useMemo, useState } from "react";
import { AGENTS, AGENT_RESPONSES, DIMENSIONS, INTERACTIONS, type Dim } from "../../../supabase/functions/_shared/autosim_engine";
import type { AutoSimResult } from "@/lib/autoSimApi";
import { pct } from "@/lib/autosimFormat";

// Nodes are the model's real entities: 10 economic dimensions (inner ring) and 7 agent groups (outer ring).
// Edge weight = the engine's actual interaction / response coefficient. Colour = simulated change vs start.
const BAD_WHEN_UP = new Set<Dim>(["fear", "volatility", "default_risk", "inflation"]);
export const label = (d: string) => d.replace(/_/g, " ");

export default function DimensionCanvas({ result }: { result: AutoSimResult | null }) {
  const [zoom, setZoom] = useState(1);
  const [sel, setSel] = useState<string | null>(null);
  const cx = 300, cy = 300;
  const pos = useMemo(() => {
    const p: Record<string, { x: number; y: number }> = {};
    DIMENSIONS.forEach((d, i) => { const a = (i / DIMENSIONS.length) * Math.PI * 2 - Math.PI / 2; p[d] = { x: cx + 130 * Math.cos(a), y: cy + 130 * Math.sin(a) }; });
    AGENTS.forEach((g, i) => { const a = (i / AGENTS.length) * Math.PI * 2 - Math.PI / 2 + 0.2; p[g] = { x: cx + 235 * Math.cos(a), y: cy + 235 * Math.sin(a) }; });
    return p;
  }, []);
  const change = (d: Dim) => (result ? result.dimensions.distribution[d].p50 - result.state.baseline[d] : 0);
  const tone = (d: Dim) => { const c = result ? (BAD_WHEN_UP.has(d) ? change(d) : -change(d)) : 0; return !result || Math.abs(c) < 0.005 ? "var(--gold-dim)" : c > 0 ? "var(--red)" : "var(--green)"; };

  const detail = (() => {
    if (!sel || !result) return null;
    if ((DIMENSIONS as readonly string[]).includes(sel)) {
      const d = sel as Dim, x = result.dimensions.distribution[d];
      return `${label(d)}: starts ${pct(x.baseline, 0)} (${result.state.detail[d].source}) → median ${pct(x.p50, 0)}, 5–95% range ${pct(x.p5, 0)}–${pct(x.p95, 0)}.${result.interpretation.shock_rationale[d] ? " Why: " + result.interpretation.shock_rationale[d] : ""}`;
    }
    const g = sel as typeof AGENTS[number];
    return `${label(g)} (simulated): response score ${pct(result.agents[g], 1)}. Reacts to ${Object.keys(AGENT_RESPONSES[g]).map(label).join(", ")}.`;
  })();

  return (
    <div className="sim-canvas">
      <div className="sim-canvas-tools">
        <Button variant="ghost" className="sim-mini" onClick={() => setZoom(z => Math.min(2, z + 0.25))} aria-label="Zoom in">+</Button>
        <Button variant="ghost" className="sim-mini" onClick={() => setZoom(z => Math.max(0.6, z - 0.25))} aria-label="Zoom out">−</Button>
        <Button variant="ghost" className="sim-mini" onClick={() => { setZoom(1); setSel(null); }}>Reset</Button>
        <span className="sim-legend"><i className="stress" /> more stress <i className="relief" /> less stress <i className="unchanged" /> unchanged</span>
      </div>
      <svg viewBox="0 0 600 600" role="img" aria-label="Economic system graph" style={{ transform: `scale(${zoom})` }}>
        {DIMENSIONS.flatMap(t => Object.entries(INTERACTIONS[t]).map(([s, c]) => (
          <line key={`${s}-${t}`} x1={pos[s].x} y1={pos[s].y} x2={pos[t].x} y2={pos[t].y} stroke={(c as number) > 0 ? "var(--cyan)" : "var(--red)"} strokeWidth={Math.abs(c as number) * 60} />
        )))}
        {AGENTS.flatMap(g => Object.entries(AGENT_RESPONSES[g]).map(([d, w]) => (
          <line key={`${g}-${d}`} x1={pos[g].x} y1={pos[g].y} x2={pos[d].x} y2={pos[d].y} stroke="var(--gold-dim)" strokeWidth={Math.abs(w as number) * 4} />
        )))}
        {DIMENSIONS.map(d => (
          <g key={d} onClick={() => setSel(d)} style={{ cursor: "pointer" }} tabIndex={0} role="button" aria-label={`${label(d)} node`} onKeyDown={e => e.key === "Enter" && setSel(d)}>
            <circle cx={pos[d].x} cy={pos[d].y} r={sel === d ? 24 : 20} fill="var(--dark)" stroke={tone(d)} strokeWidth={2} />
            <text x={pos[d].x} y={pos[d].y + 3} textAnchor="middle" fontSize="8" fill="var(--text)">{label(d).split(" ")[0]}</text>
          </g>
        ))}
        {AGENTS.map(g => (
          <g key={g} onClick={() => setSel(g)} style={{ cursor: "pointer" }} tabIndex={0} role="button" aria-label={`${label(g)} agent node`} onKeyDown={e => e.key === "Enter" && setSel(g)}>
            <rect x={pos[g].x - 30} y={pos[g].y - 11} width="60" height="22" rx="3" fill="var(--dark)" stroke={sel === g ? "var(--gold-bright)" : "var(--gold-dim)"} />
            <text x={pos[g].x} y={pos[g].y + 3} textAnchor="middle" fontSize="8" fill="var(--gold)">{label(g)}</text>
          </g>
        ))}
      </svg>
      <p className="sim-note">{detail ?? (result ? "Select a node to inspect it." : "Run a simulation to populate the graph. Lines are the model's real interaction weights: cyan reinforces, red offsets.")}</p>
    </div>
  );
}
