import { createGeminiFailover, geminiFetch, hasGeminiKeys } from './gemini_failover.ts';
// Server-only Gemini adapter. Retry only model-not-found, never ambiguous failures.
import { availableGeminiModels } from './simulation_chat_contract.ts';
declare const Deno: { env: { get(key: string): string | undefined } };
export class GeminiError extends Error {
  constructor(public code: 'not_configured' | 'model_unavailable' | 'rate_limited' | 'upstream' | 'bad_output' | 'timeout', message: string, public status = 502) {
    super(message); this.name = 'GeminiError';
  }
}
export const hasConfiguredAI = () => hasGeminiKeys() || !!Deno.env.get('LOVABLE_API_KEY');
export interface GenOpts { system?: string; prompt: string; json?: boolean; maxOutputTokens?: number; temperature?: number; timeoutMs?: number }
export async function generateGemini(key: string, configuredModel: string | undefined, body: unknown, fetcher: typeof fetch = fetch, timeoutMs = 18000, transport?: typeof geminiFetch): Promise<{text: string; model: string}> {
  if (!key) throw new GeminiError('not_configured', 'AI service is not configured', 503);
  let models: string[];
  try { models = availableGeminiModels(configuredModel); }
  catch { throw new GeminiError('model_unavailable', 'Invalid Gemini model configuration', 503); }
  const deadline = Date.now() + timeoutMs;
  const send = transport ?? createGeminiFailover({credentials:()=>[{slot:'explicit',value:key}],fetch:fetcher});
  for (const model of models) {
    let response: Response;
    try {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new Error('deadline');
      const requestBody = body && typeof body === 'object' ? {...body as Record<string,unknown>} : body;
      if(/^gemini-2\.5-flash(?:-lite)?$/.test(model) && requestBody && typeof requestBody === 'object'){
        const config=(requestBody as Record<string,unknown>).generationConfig;
        if(config && typeof config==='object' && 'responseMimeType' in config && config.responseMimeType==='application/json')
          (requestBody as Record<string,unknown>).generationConfig={...config,thinkingConfig:{thinkingBudget:0}};
      }
      response = await send(model, JSON.stringify(requestBody), remaining);
    } catch(e) {
      const timedOut=Date.now()>=deadline || (e instanceof Error && /timeout|abort|timed out/i.test(e.name+' '+e.message));
      throw new GeminiError(timedOut?'timeout':'upstream',timedOut?'AI request timed out':'AI provider connection unavailable',timedOut?504:502);
    }
    if (response.status === 404) { await response.body?.cancel(); continue; }
    if (!response.ok) {
      const message=response.status===429?'AI provider is rate-limited. Try again later.':response.status===401||response.status===403?'AI provider rejected the server credential or model access. Check the hosted Gemini secret and model.':response.status===400?'AI provider rejected the model or generation settings. Check GEMINI_MODEL.':`AI provider unavailable (HTTP ${response.status}).`;
      throw new GeminiError(response.status===429?'rate_limited':'upstream',message,response.status===429?429:502);
    }
    let result;
    try { result = await response.json(); } catch(e) {
      if(Date.now()>=deadline || (e instanceof Error && /TimeoutError|AbortError/.test(e.name)))throw new GeminiError('timeout','AI request timed out while reading the answer',504);
      throw new GeminiError('bad_output', 'AI returned invalid JSON', 502);
    }
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
export async function generateConfigured(body: GenerationBody, timeoutMs = 18000, configuredModel?:string) {
  body={...body,systemInstruction:{parts:[...(body.systemInstruction?.parts||[]),{text:"Respond in English. Translate foreign-language evidence descriptions into English while preserving source references, names and uncertainty. Structured JSON keys must remain exactly as requested."}]}};
  if (hasGeminiKeys()) return generateGemini('configured-slots', configuredModel || Deno.env.get('GEMINI_MODEL'), body, fetch, timeoutMs, geminiFetch);
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
