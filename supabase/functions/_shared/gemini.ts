import { geminiFetch, hasGeminiKeys } from "./gemini_failover.ts";
// Server-only adapter. Use the approved bounded model list; retry only model 404s.
import { availableGeminiModels } from "./simulation_chat_contract.ts";

export class GeminiError extends Error {
  constructor(public code: "not_configured" | "model_unavailable" | "rate_limited" | "upstream" | "bad_output" | "timeout", message: string, public status = 502) {
    super(message); this.name = "GeminiError";
  }
}
export interface GenOpts { system?: string; prompt: string; json?: boolean; maxOutputTokens?: number; temperature?: number; timeoutMs?: number }
export async function generate(o: GenOpts): Promise<{ text: string; model: string }> {
  if (!hasGeminiKeys()) throw new GeminiError("not_configured", "AI service is not configured", 503);
  let models: string[];
  try { models = availableGeminiModels(Deno.env.get("GEMINI_MODEL")); }
  catch { throw new GeminiError("model_unavailable", "Invalid Gemini model configuration", 503); }
  for (const model of models) {
    let r: Response;
    try {
      r = await geminiFetch(model, JSON.stringify({
          ...(o.system ? { systemInstruction: { parts: [{ text: o.system }] } } : {}),
          contents: [{ role: "user", parts: [{ text: o.prompt }] }],
          generationConfig: { maxOutputTokens: o.maxOutputTokens ?? 2000, temperature: o.temperature ?? 0.4, ...(o.json ? { responseMimeType: "application/json" } : {}) },
        }), o.timeoutMs ?? 18000);
    } catch { throw new GeminiError("timeout", "AI request timed out", 504); }
    if (r.status === 404) { console.warn("Gemini model unavailable", model, 404); continue; }
    if (!r.ok) {
      console.warn("Gemini request failed", model, r.status);
      throw new GeminiError(r.status === 429 ? "rate_limited" : "upstream", r.status === 429 ? "Gemini is rate-limited" : `Gemini request failed (${r.status})`, r.status === 429 ? 429 : 502);
    }
    const j = await r.json().catch(() => null);
    const text = (j?.candidates?.[0]?.content?.parts ?? []).filter((p: { thought?: boolean }) => !p.thought).map((p: { text?: string }) => p.text ?? "").join("");
    if (!text.trim()) throw new GeminiError("bad_output", "AI returned no answer", 502);
    return { text, model };
  }
  throw new GeminiError("model_unavailable", "No supported Gemini model is accessible for the configured API key", 503);
}
export async function generateJSON<T = Record<string, unknown>>(o: Omit<GenOpts, "json">): Promise<{ data: T; model: string }> {
  const { text, model } = await generate({ ...o, json: true });
  try { return { data: JSON.parse(text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim()) as T, model }; }
  catch { throw new GeminiError("bad_output", "AI returned invalid JSON", 502); }
}