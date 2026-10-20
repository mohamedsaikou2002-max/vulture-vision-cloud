// Server-only credential transport. Never put credentials in URLs, logs or errors.
declare const Deno: { env: { toObject(): Record<string, string> } };
export interface GeminiCredential { slot: string; value: string }
export function configuredGeminiKeys(env: Record<string, string | undefined>): GeminiCredential[] {
  const names = Object.keys(env).filter(name => /^GEMINI_API_KEY(?:_[1-9][0-9]*)?$/.test(name));
  names.sort((a, b) => (a === 'GEMINI_API_KEY' ? 0 : Number(a.slice(15))) - (b === 'GEMINI_API_KEY' ? 0 : Number(b.slice(15))));
  const seen = new Set<string>();
  return names.flatMap(slot => {
    const value = env[slot]?.trim();
    if (!value || seen.has(value)) return [];
    seen.add(value);
    return [{ slot, value }];
  }).slice(0, 21);
}
export function hasGeminiKeys(): boolean { return configuredGeminiKeys(Deno.env.toObject()).length > 0; }
export function createGeminiFailover(deps: {
  credentials: () => GeminiCredential[];
  fetch: typeof fetch;
  now?: () => number;
}) {
  const cooldowns = new Map<string, number>(); // Best effort within a warm worker; Google remains quota authority.
  const now = deps.now ?? Date.now;
  return async (model: string, body: string, timeoutMs: number): Promise<Response> => {
    if (!/^[A-Za-z0-9_.-]{3,80}$/.test(model)) throw new Error('Invalid Gemini model configuration');
    const keys = deps.credentials();
    if (!keys.length) throw new Error('Gemini is not configured');
    const deadline = now() + timeoutMs;
    let retrySeconds = 60;
    for (const { slot, value } of keys) {
      const cooldownId = `${slot}:${model}`;
      const until = cooldowns.get(cooldownId) ?? 0;
      if (until > now()) { retrySeconds = Math.max(retrySeconds, Math.ceil((until - now()) / 1000)); continue; }
      const remaining = deadline - now();
      if (remaining <= 0) throw new Error('Gemini request timed out');
      let response: Response;
      try {
        response = await deps.fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': value },
          body, signal: AbortSignal.timeout(remaining),
        });
      } catch { throw new Error('Gemini request unavailable'); }
      if (response.ok) return response;
      if (response.status !== 429) {
        await response.body?.cancel();
        return new Response(JSON.stringify({ error: { message: `Gemini request failed (${response.status})` } }), {
          status: response.status, headers: { 'Content-Type': 'application/json' },
        });
      }
      const rawRetry = response.headers.get('Retry-After');
      const delay = rawRetry && /^\d+(\.\d+)?$/.test(rawRetry) ? Number(rawRetry) * 1000 : rawRetry ? Date.parse(rawRetry) - now() : 60000;
      const waitMs = Number.isFinite(delay) ? Math.max(1000, delay) : 60000;
      cooldowns.set(cooldownId, now() + waitMs);
      retrySeconds = Math.max(retrySeconds, Math.ceil(waitMs / 1000));
      await response.body?.cancel();
      // No retries of this credential: only the next configured credential is attempted.
    }
    return new Response(JSON.stringify({ error: { message: 'Gemini quota unavailable across configured keys; retry later' } }), {
      status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(retrySeconds) },
    });
  };
}
export const geminiFetch = createGeminiFailover({
  credentials: () => configuredGeminiKeys(Deno.env.toObject()),
  fetch: (input, init) => globalThis.fetch(input, init),
});