// Percentage formatting for AutoSim displays — model outputs are 0–1 state variables.
export function pct(v: number | null | undefined, d = 1): string {
  return v == null || !Number.isFinite(v) ? "—" : `${(v * 100).toFixed(d)}%`;
}
// Signed percentage for deltas (adds a leading + for gains).
export function signedPct(v: number | null | undefined, d = 1): string {
  return v == null || !Number.isFinite(v) ? "—" : `${v > 0 ? "+" : ""}${pct(v, d)}`;
}
