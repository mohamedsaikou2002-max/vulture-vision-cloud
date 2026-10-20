import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configuredGeminiKeys, createGeminiFailover } from '../../supabase/functions/_shared/gemini_failover';

const credentials = () => [{ slot: 'GEMINI_API_KEY', value: 'test-primary' }, { slot: 'GEMINI_API_KEY_1', value: 'test-backup' }];
describe('Gemini secure failover', () => {
  // jsdom lacks AbortSignal.timeout; model it without real timers or provider traffic.
  beforeEach(() => vi.stubGlobal('AbortSignal', { timeout: vi.fn(() => new AbortController().signal) }));
  afterEach(() => vi.unstubAllGlobals());
  it('discovers numbered secrets in order and deduplicates without exposing them', () => {
    const keys = configuredGeminiKeys({ GEMINI_API_KEY_10: 'ten', GEMINI_API_KEY_2: 'two', GEMINI_API_KEY: 'primary', GEMINI_API_KEY_1: 'primary', OTHER: 'ignore' });
    expect(keys.map(k => k.slot)).toEqual(['GEMINI_API_KEY', 'GEMINI_API_KEY_2', 'GEMINI_API_KEY_10']);
  });
  it('uses the next key after 429 and returns the actual response', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response('', { status: 429 })).mockResolvedValueOnce(new Response('{"answer":"real"}'));
    const request = createGeminiFailover({ credentials, fetch });
    expect(await (await request('gemini-3.8-flash', '{}', 40000)).json()).toEqual({ answer: 'real' });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1][1].headers['x-goog-api-key'] === credentials()[1].value).toBe(true);
    expect(fetch.mock.calls[0][0]).not.toContain('?key=');
  });
  it('honors Retry-After on subsequent requests in a warm worker', async () => {
    let clock = 0;
    const fetch = vi.fn().mockResolvedValueOnce(new Response('', { status: 429, headers: { 'Retry-After': '120' } })).mockImplementation(async () => new Response('{}'));
    const request = createGeminiFailover({ credentials, fetch, now: () => clock });
    await request('gemini-3.8-flash', '{}', 40000);
    clock = 60000;
    await request('gemini-3.8-flash', '{}', 40000);
    expect(fetch.mock.calls[2][1].headers['x-goog-api-key'] === credentials()[1].value).toBe(true);
    clock = 120001;
    await request('gemini-3.8-flash', '{}', 40000);
    expect(fetch.mock.calls[3][1].headers['x-goog-api-key'] === credentials()[0].value).toBe(true);
  });
  it.each([400, 401, 403, 404, 500, 503])('does not rotate for HTTP %s or relay potentially sensitive errors', async status => {
    const fetch = vi.fn().mockResolvedValue(new Response('private provider details', { status }));
    const r = await createGeminiFailover({ credentials, fetch })('gemini-3.8-flash', '{}', 40000);
    expect(r.status).toBe(status);
    expect(await r.text()).not.toContain('private provider details');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('stops after each key is exhausted and returns 429, not a fabricated answer', async () => {
    const fetch = vi.fn().mockImplementation(async () => new Response('', { status: 429 }));
    const request = createGeminiFailover({ credentials, fetch });
    const r = await request('gemini-3.8-flash', '{}', 40000);
    expect(r.status).toBe(429);
    expect(r.headers.get('Retry-After')).toBe('60');
    await request('gemini-3.8-flash', '{}', 40000);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('fails closed when no keys are configured', async () => {
    const fetch = vi.fn();
    await expect(createGeminiFailover({ credentials: () => [], fetch })('gemini-3.8-flash', '{}', 40000)).rejects.toThrow('not configured');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('does not rotate or expose transport exceptions', async () => {
    const fetch = vi.fn().mockRejectedValue(new Error('sensitive transport detail'));
    await expect(createGeminiFailover({ credentials, fetch })('gemini-3.8-flash', '{}', 40000)).rejects.toThrow('Gemini request unavailable');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});