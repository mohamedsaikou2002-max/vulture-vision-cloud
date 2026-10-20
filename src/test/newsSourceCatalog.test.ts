import { readFileSync } from 'node:fs';
import { transferableAbortController } from 'node:util';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { additionalTechFeeds } from '../../supabase/functions/vv-news/additional_sources';
import { loadEdgeHandler } from './helpers/edgeHarness';

const catalog = JSON.parse(readFileSync('news-crawler/source-pack/global_blog_candidates.json', 'utf8'));
beforeAll(() => vi.stubGlobal('AbortSignal', transferableAbortController().signal.constructor));
afterAll(() => vi.unstubAllGlobals());

describe('Uploaded publisher candidates', () => {
  it('retains all 207 candidates without silently enabling unreviewed crawling', () => {
    expect(catalog.sources).toHaveLength(207);
    expect(catalog.sources.filter((source: { enabled: boolean }) => source.enabled)).toHaveLength(0);
    expect(new Set(catalog.sources.map((source: { id: string }) => source.id)).size).toBe(207);
  });
});

describe('Additional live publisher feeds', () => {
  it('connects the three spot-checked publishers using unique HTTPS subscriptions', () => {
    expect(additionalTechFeeds.map(feed => feed.source)).toEqual(['Cloudflare Blog', 'Ethereum Foundation Blog', 'The Register']);
    expect(new Set(additionalTechFeeds.map(feed => feed.url)).size).toBe(3);
    expect(additionalTechFeeds.every(feed => new URL(feed.url).protocol === 'https:')).toBe(true);
  });

  it('returns real feed metadata through the news handler and reports unavailable subscriptions separately', async () => {
    const now = new Date().toISOString();
    const fetcher: typeof fetch = async input => String(input) === additionalTechFeeds[0].url
      ? new Response(`<rss><channel><item><title>Publisher update</title><link>https://blog.cloudflare.com/update/</link><pubDate>${now}</pubDate><description>Body excluded</description></item></channel></rss>`)
      : new Response('', { status: 503 });
    const response = await loadEdgeHandler('vv-news', fetcher, {}, () => ({
      auth: { getUser: async () => ({ data: { user: null }, error: null }) },
      from: () => { throw new Error('Database unavailable'); },
    }))(new Request('https://fixture.invalid', { method: 'POST', body: '{}' }));
    const result = await response.json();
    expect(response.status, JSON.stringify(result)).toBe(200);
    expect(result.tech[0]).toMatchObject({ source: 'Cloudflare Blog', link: 'https://blog.cloudflare.com/update/', time: now });
    expect(result.source_health).toContainEqual({ source: 'Cloudflare Blog', status: 'available', count: 1 });
    expect(result.source_health).toContainEqual({ source: 'The Register', status: 'unavailable', count: 0 });
    expect(result.status).toBe('degraded');
    expect(JSON.stringify(result)).not.toContain('Body excluded');
  });
});