// Server-only Gemini adapter. Retry only model-not-found, never ambiguous failures.
import { availableGeminiModels } from './simulation_chat_contract.ts';
declare const Deno: { env: { get(key: string): string | undefined } };
export class GeminiError extends Error {
  constructor(public code: 'not_configured' | 'model_unavailable' | 'rate_limited' | 'upstream' | 'bad_output' | 'timeout', message: string, public status = 502) {
    super(message); this.name = 'GeminiError';
  }
}
export interface GenOpts { system?: string; prompt: string; json?: boolean; maxOutputTokens?: number; temperature?: number; timeoutMs?: number }
export async function generateGemini(key: string, configuredModel: string | undefined, body: unknown, fetcher: typeof fetch = fetch, timeoutMs = 18000): Promise<{text: string; model: string}> {
  if (!key) throw new GeminiError('not_configured', 'AI service is not configured', 503);
  let models: string[];
  try { models = availableGeminiModels(configuredModel); }
  catch { throw new GeminiError('model_unavailable', 'Invalid Gemini model configuration', 503); }
  const signal = AbortSignal.timeout(timeoutMs);
  for (const model of models) {
    let response: Response;
    try {
      response = await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, signal, body: JSON.stringify(body),
      });
    } catch { throw new GeminiError('timeout', 'AI request timed out', 504); }
    if (response.status === 404) { await response.body?.cancel(); continue; }
    if (!response.ok) throw new GeminiError(response.status === 429 ? 'rate_limited' : 'upstream', response.status === 429 ? 'AI provider is rate-limited. Try again later.' : 'AI provider request failed.', response.status === 429 ? 429 : 502);
    let result;
    try { result = await response.json(); } catch { throw new GeminiError('bad_output', 'AI returned invalid JSON', 502); }
    const parts = result?.candidates?.[0]?.content?.parts;
    const text = Array.isArray(parts) ? parts.filter((p: {thought?: boolean}) => !p.thought).map((p: {text?: unknown}) => typeof p.text === 'string' ? p.text : '').join('').trim() : '';
    if (!text) throw new GeminiError('bad_output', 'AI provider returned no answer.', 502);
    return { text, model };
  }
  throw new GeminiError('model_unavailable', 'No configured AI model is accessible.', 503);
}
export async function generate(o: GenOpts) {
  return generateConfigured({
    ...(o.system ? { systemInstruction: { parts: [{ text: o.system }] } } : {}),
    contents: [{ role: 'user', parts: [{ text: o.prompt }] }],
    generationConfig: { maxOutputTokens: o.maxOutputTokens ?? 2000, temperature: o.temperature ?? 0.4, ...(o.json ? { responseMimeType: 'application/json' } : {}) },
  }, o.timeoutMs);
}
export async function generateJSON<T = Record<string, unknown>>(o: Omit<GenOpts, 'json'>): Promise<{data: T; model: string}> {
  const { text, model } = await generate({ ...o, json: true });
  try { return { data: JSON.parse(text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()) as T, model }; }
  catch { throw new GeminiError('bad_output', 'AI returned invalid JSON', 502); }
}

interface GenerationBody {
  systemInstruction?: { parts?: { text?: string }[] };
  contents?: { role: string; parts?: { text?: string }[] }[];
  generationConfig?: { maxOutputTokens?: number; temperature?: number; responseMimeType?: string };
}
/** Reuse the provider already configured by the host. Never retry a failed inference through another provider. */
export async function generateConfigured(body: GenerationBody, timeoutMs = 18000) {
  const native = Deno.env.get('GEMINI_API_KEY');
  if (native) return generateGemini(native, Deno.env.get('GEMINI_MODEL'), body, fetch, timeoutMs);
  const gateway = Deno.env.get('LOVABLE_API_KEY');
  if (!gateway) throw new GeminiError('not_configured', 'AI service is not configured', 503);
  const model = Deno.env.get('LOVABLE_AI_MODEL') || 'google/gemini-2.5-flash';
  if (!/^[A-Za-z0-9_./-]{3,80}$/.test(model)) throw new GeminiError('model_unavailable', 'Invalid AI gateway model configuration', 503);
  const messages: {role: string; content: string}[] = [];
  const system = body.systemInstruction?.parts?.map(p=>p.text || '').join('');
  if (system) messages.push({role:'system',content:system});
  for (const turn of body.contents || []) messages.push({role:turn.role==='model'?'assistant':'user',content:turn.parts?.map(p=>p.text||'').join('') || ''});
  let response: Response;
  try { response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${gateway}`},signal:AbortSignal.timeout(timeoutMs),
    body:JSON.stringify({model,messages,max_tokens:body.generationConfig?.maxOutputTokens ?? 2000,temperature:body.generationConfig?.temperature ?? .35,...(body.generationConfig?.responseMimeType==='application/json'?{response_format:{type:'json_object'}}:{})}),
  }); } catch { throw new GeminiError('timeout','AI request timed out',504); }
  if(!response.ok)throw new GeminiError(response.status===429?'rate_limited':'upstream',response.status===429?'AI provider is rate-limited. Try again later.':'AI gateway request failed.',response.status===429?429:502);
  const data=await response.json().catch(()=>null);
  const text=data?.choices?.[0]?.message?.content;
  if(typeof text!=='string'||!text.trim())throw new GeminiError('bad_output','AI provider returned no answer.',502);
  return {text:text.trim(),model};
}
