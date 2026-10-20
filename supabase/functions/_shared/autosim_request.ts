const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DIMS = ["fear", "trust", "liquidity", "volatility", "credit", "consumer_activity", "inflation", "employment", "growth", "default_risk"];
export function dailyLimit(value?: string): number {
  const n = Number(value ?? 40);
  return Number.isInteger(n) && n >= 1 && n <= 40 ? n : 40;
}
export function boundedPaths(value: string | undefined, fallback: number, max: number): number {
  const n = Number(value ?? fallback);
  return Number.isInteger(n) && n >= 1 && n <= max ? n : fallback;
}
export function parseAutoSimRequest(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid request");
  const b = value as Record<string, unknown>;
  const action = b.action ?? "run";
  if (!["run", "interrogate", "world_state"].includes(String(action))) throw new Error("Invalid action");
  if (action === "world_state") return { action };
  if (typeof b.job_id !== "string" || !UUID.test(b.job_id)) throw new Error("Invalid job ID");
  if (action === "interrogate") {
    if (typeof b.question !== "string" || b.question.trim().length < 3 || b.question.length > 400 || !["banks", "investors", "consumers", "businesses", "governments", "central_banks", "labor"].includes(String(b.agent))) throw new Error("Invalid agent question");
    return { action, job_id: b.job_id, question: b.question.trim(), agent: b.agent };
  }
  if (typeof b.scenario !== "string" || b.scenario.trim().length < 8 || b.scenario.trim().length > 2000) throw new Error("Invalid scenario");
  if (b.parent_job_id !== undefined && (typeof b.parent_job_id !== "string" || !UUID.test(b.parent_job_id))) throw new Error("Invalid parent ID");
  if (b.inject !== undefined) {
    const i = b.inject as { dimension?: unknown; delta?: unknown } | null;
    if (!i || !DIMS.includes(String(i.dimension)) || typeof i.delta !== "number" || !Number.isFinite(i.delta) || Math.abs(i.delta) > 0.2) throw new Error("Invalid shock");
  }
  if (b.article_ids !== undefined && (!Array.isArray(b.article_ids) || b.article_ids.length > 8 || b.article_ids.some(id=>typeof id!=='string'||!/^[a-f0-9]{64}$/i.test(id)))) throw new Error('Invalid headline references');
  return { ...(b.article_ids ? { article_ids: b.article_ids } : {}), action, job_id: b.job_id, scenario: b.scenario.trim(), ...(b.parent_job_id ? { parent_job_id: b.parent_job_id } : {}), ...(b.inject ? { inject: b.inject } : {}) };
}