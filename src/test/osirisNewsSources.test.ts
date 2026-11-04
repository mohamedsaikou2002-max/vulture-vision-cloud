import { describe, expect, it } from "vitest";
import { osirisNewsSources } from "../../supabase/functions/vv-news/osiris_news_sources";
import { sourceCatalog } from "../../supabase/functions/vv-news/source_catalog";
import { newsColumn } from "../../supabase/functions/vv-news/catalog_rules";
import { parseRss } from "../../supabase/functions/_shared/news_feed";

describe("OSIRIS publisher-only news source pack", () => {
  it("adds exactly 40 additional publisher RSS feeds to the persistent news catalog", () => {
    const contributed = sourceCatalog.filter(source => source.id.startsWith("osiris-news-"));
    expect(osirisNewsSources).toHaveLength(40);
    expect(contributed).toHaveLength(osirisNewsSources.length);
    expect(sourceCatalog).toHaveLength(327);
    expect(new Set(sourceCatalog.map(source => source.id)).size).toBe(sourceCatalog.length);
  });

  it("retains original publisher attribution and URLs for worldwide coverage", () => {
    const ids = new Set<string>();
    const feeds = new Set<string>();
    for (const source of osirisNewsSources) {
      expect(source.name).not.toBe("OSIRIS");
      expect(source.id).toMatch(/^osiris-news-\d{3}$/);
      expect(source.source_country).toMatch(/^[A-Z]{2}$/);
      expect(source.feed_urls).toHaveLength(1);
      expect(ids.has(source.id)).toBe(false);
      ids.add(source.id);
      expect(source.allowed_hosts).toEqual([]);
      expect(new URL(source.homepage).protocol).toBe("https:");
      for (const url of source.feed_urls) {
        expect(new URL(url).protocol).toBe("https:");
        expect(feeds.has(url)).toBe(false);
        feeds.add(url);
        // Non-news feeds, social claims, video embeds, scanners and transport layers are not in scope.
        expect(url).not.toMatch(/opensky|adsb|flights|aircraft|planes|cctv|camera|satellite|maritime|vessel|earthquake|fire|weather|scanner|telegram|t\.me\/|youtu\.be|youtube\.com/i);
      }
    }
    expect(feeds.size).toBe(40);
    expect(osirisNewsSources.some(source => source.name === "The Guardian")).toBe(true);
    expect(osirisNewsSources.some(source => source.name === "Breaking Defense")).toBe(true);
    expect(osirisNewsSources.some(source => source.name === "Times of Israel")).toBe(true);
    expect(osirisNewsSources.some(source => source.name === "CNA")).toBe(true);
    expect(osirisNewsSources.some(source => source.name === "Africanews")).toBe(true);
  });

  it("deduplicates OSIRIS subscriptions against Vulture Vision's existing catalog", () => {
    const other = sourceCatalog.filter(source => !source.id.startsWith("osiris-news-"));
    const existingUrls = new Set(other.flatMap(source => [...source.feed_urls]));
    expect(osirisNewsSources.every(source => !existingUrls.has(source.feed_urls[0]))).toBe(true);
  });

  it("routes source categories through the existing news/swarm ingestion contract", () => {
    const tech = osirisNewsSources.find(source => source.name === "Ars Technica");
    const finance = osirisNewsSources.find(source => source.name === "CNBC");
    const world = osirisNewsSources.find(source => source.name === "Times of Israel");
    expect(tech && newsColumn(tech.category)).toBe("tech");
    expect(finance && newsColumn(finance.category)).toBe("irl");
    expect(world && newsColumn(world.category)).toBe("irl");
    // The persistent news_articles insertion path keeps the publisher URL/time as evidence.
    const parsed = parseRss('<rss><channel><item><title>Market policy update</title><link>https://www.cnbc.com/story</link><pubDate>Tue, 03 Nov 2026 18:30:00 GMT</pubDate></item></channel></rss>', finance!.name);
    expect(parsed[0]).toMatchObject({ title: "Market policy update", source: "CNBC", link: "https://www.cnbc.com/story", time: "2026-11-03T18:30:00.000Z" });
  });
});
