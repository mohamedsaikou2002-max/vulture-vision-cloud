import { authorize } from '../_shared/access.ts';
import { parseIntelChat, buildIntelChatBody } from '../_shared/intel_chat.ts';
import { generateConfigured } from '../_shared/gemini.ts';
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Content-Type': 'application/json' };

Deno.serve(async (req) => {
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: corsHeaders });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  // Retain operator policy until a separate user entitlement/quota policy is deployed.
  const denied = await authorize(req, true);
  if (denied) return denied;
  const raw = await req.text();
  if (new TextEncoder().encode(raw).byteLength > 40000) return reply({ error: 'Message payload too large' }, 413);
  let request;
  try { request = parseIntelChat(JSON.parse(raw)); }
  catch (e) { return reply({ error: (e as Error).message }, 400); }
  if (!Deno.env.get('GEMINI_API_KEY') && !Deno.env.get('LOVABLE_API_KEY')) return reply({ error: 'AI service is not configured' }, 503);
  try {
    const { text, model } = await generateConfigured(buildIntelChatBody(request));
    return reply({ reply: text, model });
  } catch {
    return reply({ error: 'AI response unavailable. Check provider availability and model access.' }, 502);
  }
});
