import type { CapitalInputs } from '@/lib/currentScenario';
export default function CurrentScenarioInputs({ value, onChange, disabled }: { value: CapitalInputs; onChange: (v: CapitalInputs) => void; disabled: boolean }) {
  const update = (patch: Partial<CapitalInputs>) => onChange({ ...value, ...patch });
  const field = 'w-full rounded-lg border border-border bg-background p-3 text-sm';
  return <fieldset disabled={disabled} className="space-y-4">
    <legend className="mb-3 text-sm font-semibold">Decision context</legend>
    <label className="block text-sm">Objective<textarea rows={2} maxLength={2000} className={field + ' mt-2'} value={value.objective} onChange={e => update({ objective: e.target.value })}/></label>
    <div className="grid grid-cols-2 gap-3"><label className="text-sm">Capital (optional)<input type="number" min={1} max={1e15} className={field + ' mt-2'} value={value.capital ?? ''} placeholder="Amount" onChange={e => update({ capital: e.target.value === '' ? null : Number(e.target.value) })}/></label><label className="text-sm">Base currency<input maxLength={3} className={field + ' mt-2'} value={value.currency} onChange={e => update({ currency: e.target.value.toUpperCase() })}/></label></div>
    <div className="grid grid-cols-2 gap-3"><label className="text-sm">Horizon (days)<input type="number" min={1} max={3650} className={field + ' mt-2'} value={value.horizon_days} onChange={e => update({ horizon_days: Number(e.target.value) })}/></label><label className="text-sm">Risk tolerance<select className={field + ' mt-2'} value={value.risk_tolerance} onChange={e => update({ risk_tolerance: e.target.value as CapitalInputs['risk_tolerance'] })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label></div>
    <label className="block text-sm">Current exposures<textarea rows={2} className={field + ' mt-2'} maxLength={2000} value={value.exposures} onChange={e => update({ exposures: e.target.value })} placeholder="Assets, regions, sectors and weights, if known"/></label>
    <label className="block text-sm">Constraints<textarea rows={2} className={field + ' mt-2'} maxLength={2000} value={value.constraints} onChange={e => update({ constraints: e.target.value })} placeholder="Liquidity needs, excluded assets, limits"/></label>
    <label className="block text-sm">Decisions to compare<textarea rows={2} className={field + ' mt-2'} maxLength={2000} value={value.alternatives} onChange={e => update({ alternatives: e.target.value })} placeholder="Describe alternatives, or leave empty for exploratory candidates"/></label>
  </fieldset>;
}
