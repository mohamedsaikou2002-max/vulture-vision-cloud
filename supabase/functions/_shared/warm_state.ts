// WarmState — Supabase-backed JSON store for derived/computed cross-layer state.
// Drop-in replacement for the Python Redis wrapper. All values JSON-encoded.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const WarmKeys = {
  CORR_MATRIX: "corr_matrix",
  AMPLITUDE_VECTOR: "amplitude_vector",
  HAMILTONIAN_PARAMS: "hamiltonian_params",
  COHERENCE_SCORE: "coherence_score",
  MIROFISH_VERDICT: "mirofish_verdict",
  QUANTUM_ALLOCATION: "quantum_allocation",
  REGIME_STATE: "regime_state",
  DOMINANT_REGIME: "dominant_regime",
  EIGENVALUE_GAP: "eigenvalue_gap",
  TRANSITION_PROB: "transition_prob",
  HEGELIAN_SYNTHESIS: "hegelian_synthesis",
  PORTFOLIO_STATE: "portfolio_state",
  PAPER_METRICS: "paper_metrics",
  FEATURE_VECTORS: "feature_vectors",
  LSTM_SIGNALS: "lstm_signals",
  QAE_PROBABILITIES: "qae_probabilities",
  NEWS_FEED: "news_feed",
  ONCHAIN_EVENTS: "onchain_events",
  ETH_GAS: "eth_gas",
  KILL_SWITCH: "kill_switch_active",
  QUANTUM_BACKEND: "quantum_backend",
  LATEST_SYNTHESIS: "latest_synthesis",
  VALIDATION_REPORT: "validation_report",
  THESIS: "thesis_output",
  ANTITHESIS: "antithesis_output",
  MERGED_SIGNALS: "merged_signals",
  SIZED_POSITIONS: "sized_positions",
  QAOA_EXEC_MS: "qaoa_execution_ms",
  EIGENVALUES: "eigenvalues",
  EIGENVECTORS: "eigenvectors",
  SYNTH_NARRATIVE: "synthesis_narrative",
} as const;

export class WarmState {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client ?? createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
  }

  async ping(): Promise<boolean> {
    try {
      const { error } = await this.client.from("warm_state").select("key").limit(1);
      return !error;
    } catch { return false; }
  }

  async latencyMs(): Promise<number> {
    const t0 = performance.now();
    const ok = await this.ping();
    return ok ? performance.now() - t0 : -1;
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<boolean> {
    try {
      const expires_at = ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000).toISOString() : null;
      const { error } = await this.client
        .from("warm_state")
        .upsert({ key, value: value as any, expires_at }, { onConflict: "key" });
      if (error) { console.warn(`[warm_state] set(${key}) failed:`, error.message); return false; }
      return true;
    } catch (e) {
      console.warn(`[warm_state] set(${key}) threw:`, e);
      return false;
    }
  }

  async get<T = any>(key: string, defaultValue: T | null = null): Promise<T | null> {
    try {
      const { data, error } = await this.client
        .from("warm_state").select("value, expires_at").eq("key", key).maybeSingle();
      if (error || !data) return defaultValue;
      if (data.expires_at && new Date(data.expires_at) < new Date()) return defaultValue;
      return data.value as T;
    } catch (e) {
      console.warn(`[warm_state] get(${key}) threw:`, e);
      return defaultValue;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const { error } = await this.client.from("warm_state").delete().eq("key", key);
      return !error;
    } catch { return false; }
  }

  async keys(pattern = "%"): Promise<string[]> {
    try {
      const sql = pattern.replace(/\*/g, "%");
      const { data, error } = await this.client
        .from("warm_state").select("key").like("key", sql);
      if (error || !data) return [];
      return data.map((r: any) => r.key);
    } catch { return []; }
  }
}
