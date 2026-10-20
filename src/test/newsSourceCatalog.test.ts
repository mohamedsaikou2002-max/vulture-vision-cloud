import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const catalog = JSON.parse(readFileSync('news-crawler/source-pack/global_blog_candidates.json', 'utf8'));

describe('Uploaded publisher candidates', () => {
  it('retains all 207 candidates without silently enabling unreviewed crawling', () => {
    expect(catalog.sources).toHaveLength(207);
    expect(catalog.sources.filter((source: { enabled: boolean }) => source.enabled)).toHaveLength(0);
    expect(new Set(catalog.sources.map((source: { id: string }) => source.id)).size).toBe(207);
  });
});