import { transferableAbortController } from "node:util";
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import * as ts from 'typescript';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

type Handler = (request: Request) => Promise<Response>;
/** Execute the real edge entry points with isolated Deno/auth/network adapters. */
function edge(name: string, fetcher: typeof fetch, values: Record<string, string> = {}, denied = false) {
  let handler: Handler;
  const modules = new Map<string, Record<string, unknown>>();
  const source = resolve(process.cwd(), 'supabase/functions', name, 'index.ts');
  const query = () => {
    const chain: Record<string, unknown> = {};
    for (const method of ['select', 'order', 'limit', 'gte', 'or', 'eq', 'abortSignal']) chain[method] = () => chain;
    chain.then = (done: (value: unknown) => unknown) => Promise.resolve({ data: null, error: { message: 'fixture unavailable' } }).then(done);
    return chain;
  };
  function load(path: string): Record<string, unknown> {
    if (modules.has(path)) return modules.get(path)!;
    const exports = {};
    const scope = createContext({ exports, URL, URLSearchParams, Request, Response, Headers, AbortSignal, TextEncoder, console,
      fetch: fetcher,
      Deno: { env: { get: (key: string) => values[key], toObject: () => ({...values}) }, serve: (value: Handler) => { handler = value; } },
      require: (specifier: string) => {
        if (specifier.endsWith('/access.ts')) return { authorize: async () => denied ? Response.json({ error: 'Operator access required' }, { status: 403 }) : null };
        if (specifier.startsWith('https://')) return { createClient: () => ({ auth: { getUser: async () => ({ data: { user: null }, error: { message: 'Fixture no session' } }) }, from: query }) };
        return load(resolve(dirname(path), specifier));
      },
    });
    modules.set(path, exports);
    runInContext(ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, scope);
    return exports;
  }
  load(source);
  return (request: Request) => handler(request);
}

describe('Audited edge handler regressions', () => {
  it('returns 503 with a null portfolio if every market source fails', async () => {
    const fetcher = vi.fn().mockImplementation(async () => new Response('', { status: 503 }));
    const response = await edge('vv-analytics', fetcher)(new Request('https://fixture.invalid', { method: 'POST' }));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.status).toBe('unavailable');
    expect(body.portfolio).toBeNull();
    expect(body.source_health.every((source: {status: string}) => source.status === 'unavailable')).toBe(true);
  });
  it('keeps fresh prices with explicit partial coverage and sends no testnet/zero-address whale request', async () => {
    const calls: string[] = [];
    const fetcher = vi.fn().mockImplementation(async (input: string | URL) => {
      const url = String(input); calls.push(url);
      if (url.includes('/coins/markets')) return Response.json([{ symbol: 'btc', name: 'Bitcoin', current_price: 100, last_updated: new Date().toISOString(), price_change_percentage_24h: 1, market_cap: 1000, total_volume: 50 }]);
      if (url.includes('/market_chart')) return Response.json({ prices: Array.from({ length: 60 }, (_, i) => [Date.now() - (59 - i) * 86400000, 100 + i]) });
      if (url.includes('api.etherscan.io')) return Response.json({ status: '1', result: { FastGasPrice: '2', ProposeGasPrice: '1', SafeGasPrice: '0.5' } });
      return new Response('', { status: 503 });
    });
    const response = await edge('vv-analytics', fetcher, { ETHERSCAN_API_KEY: 'fixture' })(new Request('https://fixture.invalid'));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.status).toBe('degraded');
    expect(body.assets[0].symbol).toBe('BTC');
    expect(body.onchain.chain).toBe('ethereum-mainnet');
    expect(body.onchain.gas_status).toBe('available');
    expect(body.onchain.whale_status).toBe('not_configured');
    expect(calls.some(url => url.includes('/v2/api?chainid=1'))).toBe(true);
    expect(calls.some(url => /sepolia|txlist|0000000000000000000000000000000000000000/.test(url))).toBe(false);
  });
  it('forwards intel evidence and history through the actual chat handler', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ candidates: [{ content: { parts: [{ text: 'Funding pressure increased.' }] } }] }));
    const response = await edge('vv-chat', fetcher, { GEMINI_API_KEY: 'fixture', GEMINI_MODEL: 'gemini-configured' })(new Request('https://fixture.invalid', { method: 'POST', body: JSON.stringify({ message: 'Why?', intel_context: 'Unique funding brief', regime: 'risk_off', history: [{ role: 'user', text: 'Prior question' }] }) }));
    expect(response.status).toBe(200);
    const sent = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(sent.contents[0].parts[0].text).toBe('Prior question');
    expect(sent.contents[1].parts[0].text).toContain('Unique funding brief');
    expect(sent.contents[1].parts[0].text).toContain('risk_off');
  });
  it('retains operator authorization without making provider requests', async () => {
    const fetcher = vi.fn();
    const response = await edge('vv-chat', fetcher, {}, true)(new Request('https://fixture.invalid', { method: 'POST', body: '{}' }));
    expect(response.status).toBe(403);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('returns unavailable and source failures when every news source fails', async () => {
    const fetcher = vi.fn().mockImplementation(async () => new Response('', { status: 503 }));
    const response = await edge('vv-news', fetcher)(new Request('https://fixture.invalid', { method: 'POST', body: '{}' }));
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body.status).toBe('unavailable');
    expect(body.news_feed).toEqual([]);
    expect(body.source_health.filter((s: {status: string}) => s.status === 'unavailable').length).toBeGreaterThan(30);
    expect(fetcher.mock.calls.every(call => call[1].signal)).toBe(true);
  });
  it('preserves valid news alongside bad dates and discloses partial coverage', async () => {
    const fetcher = vi.fn().mockImplementation(async (input: string | URL) => String(input).includes('feeds.bbci.co.uk')
      ? new Response('<rss><channel><item><title>Good headline</title><pubDate>not-a-date</pubDate><link>https://bbc.example/story</link></item></channel></rss>')
      : new Response('', { status: 503 }));
    const response = await edge('vv-news', fetcher)(new Request('https://fixture.invalid', { method: 'POST', body: '{}' }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.status).toBe('degraded');
    expect(body.irl[0].title).toBe('Good headline');
    expect(body.irl[0].time).toBeUndefined();
  });
});

// jsdom 20 lacks modern AbortSignal APIs. Use Node’s real implementation, not a timeout mock.
beforeAll(() => vi.stubGlobal("AbortSignal", transferableAbortController().signal.constructor));
afterAll(() => vi.unstubAllGlobals());
