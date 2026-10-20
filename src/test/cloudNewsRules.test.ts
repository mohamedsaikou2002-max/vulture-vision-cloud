import {describe,it,expect} from 'vitest';
import {sourceCatalog} from '../../supabase/functions/vv-news/source_catalog';
import {robotsAllowed,structuredHeadlines,newsColumn} from '../../supabase/functions/vv-news/catalog_rules';
describe('Cloud publisher rules',()=>{
  it('includes all 207 added sources beside every original source',()=>{
    expect(sourceCatalog.filter(s=>s.id.startsWith('global-extra-'))).toHaveLength(207);
    expect(sourceCatalog).toHaveLength(287);
    expect(new Set(sourceCatalog.map(s=>s.id)).size).toBe(287);
  });
  it('does not retrieve disallowed pages or sources requiring crawl delay',()=>{
    expect(robotsAllowed('User-agent: *\nDisallow: /private', '/private/story')).toBe(false);
    expect(robotsAllowed('User-agent: *\nDisallow: /\nAllow: /news', '/news/story')).toBe(true);
    expect(robotsAllowed('User-agent: *\nCrawl-delay: 10','/news')).toBe(false);
  });
  it('takes only headline metadata without article text',()=>{
    const items=structuredHeadlines('<script type="application/ld+json">{"@type":"NewsArticle","headline":"Actual headline","url":"/story","datePublished":"2026-10-20T00:00:00Z","articleBody":"Do not retain"}</script>','https://publisher.example');
    expect(items).toEqual([{title:'Actual headline',link:'https://publisher.example/story',time:'2026-10-20T00:00:00Z'}]);
  });
  it('routes macro, technology and cyber headlines into existing feeds',()=>{
    expect(newsColumn('macro')).toBe('irl');expect(newsColumn('tech')).toBe('tech');expect(newsColumn('security')).toBe('dark');
  });
});