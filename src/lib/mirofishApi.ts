// Vulture Vision — MiroFish Simulation API Client
// Connects to a running MiroFish engine on VITE_MIROFISH_HOST (default localhost:5001)

const MIROFISH_HOST = (import.meta.env.VITE_MIROFISH_HOST as string) || "localhost:5001";
const isHttps = typeof location !== "undefined" && location.protocol === "https:";
const BASE_URL = `${isHttps ? "https" : "http"}://${MIROFISH_HOST}`;

export interface SimConfig {
  scenario: string;
  agents: number;
  rounds: number;
  seed?: number;
}

export interface SimAgentState {
  id: string;
  archetype: string;
  stance: string;
  confidence: number;
  influence: number;
}

export interface SimRound {
  round: number;
  summary: string;
  sentiment: number;      // -1 .. 1
  consensus: number;      // 0 .. 1
  volatility: number;     // 0 .. 1
  top_narratives: string[];
}

export interface SimResult {
  sim_id: string;
  status: "queued" | "running" | "complete" | "failed";
  config: SimConfig;
  rounds: SimRound[];
  agents?: SimAgentState[];
  verdict?: string;
  emergent_signals?: string[];
  elapsed_ms?: number;
}

export type SimErrorKind = "offline" | "http" | "malformed" | "timeout";
export interface SimResponse {
  data: SimResult | null;
  error?: { kind: SimErrorKind; message: string; status?: number };
}

function classify(e: any): { kind: SimErrorKind; message: string } {
  const msg = String(e?.message || e);
  const kind: SimErrorKind = /timeout|abort/i.test(msg) ? "timeout" : "offline";
  return { kind, message: msg || "Network error" };
}

async function parse(res: Response): Promise<SimResponse> {
  if (!res.ok) {
    return { data: null, error: { kind: "http", status: res.status, message: `HTTP ${res.status} ${res.statusText}` } };
  }
  let json: any;
  try {
    json = await res.json();
  } catch (e: any) {
    return { data: null, error: { kind: "malformed", message: `Invalid JSON: ${e?.message || e}` } };
  }
  const payload = json?.data ?? json;
  if (!payload || typeof payload !== "object") {
    return { data: null, error: { kind: "malformed", message: "Response was not a JSON object" } };
  }
  return { data: payload as SimResult };
}

export async function runSimulation(config: SimConfig): Promise<SimResponse> {
  try {
    const res = await fetch(`${BASE_URL}/api/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
      signal: AbortSignal.timeout(120000),
    });
    return parse(res);
  } catch (e: any) {
    return { data: null, error: classify(e) };
  }
}

export async function fetchSimulation(simId: string): Promise<SimResponse> {
  try {
    const res = await fetch(`${BASE_URL}/api/simulate/${encodeURIComponent(simId)}`, {
      signal: AbortSignal.timeout(15000),
    });
    return parse(res);
  } catch (e: any) {
    return { data: null, error: classify(e) };
  }
}

export async function fetchMirofishHealth(): Promise<boolean> {
  try {
    const r = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) return false;
    const d = await r.json().catch(() => ({}));
    return d.status === "ok" || r.ok;
  } catch { return false; }
}

export function mirofishBaseUrl() { return BASE_URL; }
