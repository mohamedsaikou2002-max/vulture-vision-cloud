import {WarmState} from '../_shared/warm_state.ts';
import { authorize } from '../_shared/access.ts';
import { parseRss, newestFirst, publicationTime, safeNewsUrl, type SourceHealth } from "../_shared/news_feed.ts";
import { additionalTechFeeds } from "./additional_sources.ts";
import { collectCatalog } from './catalog_ingestion.ts';
import { sourceCatalog } from './source_catalog.ts';
import { newsColumn } from './catalog_rules.ts';
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Item {
  title: string;
  source: string;
  time?: string;
  link?: string;
  journalist?: string;
  journalist_url?: string;
  source_url?: string;
  sentiment_score?: number;
  entities?: string[];
  market_impact?: "high" | "medium" | "low";
  region?: string;
  tier?: string;
}

const POSITIVE = new Set([
  "surge","rally","bullish","gains","recovery","approval","positive","growth",
  "strong","soar","boost","breakthrough","upgrade","beat","wins","record",
]);
const NEGATIVE = new Set([
  "crash","ban","bearish","losses","recession","negative","weak","collapse",
  "fear","plunge","downturn","selloff","hack","breach","lawsuit","arrest",
]);

function sentiment(text: string): number {
  if (!text) return 0;
  const words = text.toLowerCase().match(/[a-z']+/g) || [];
  if (!words.length) return 0;
  let pos = 0, neg = 0;
  for (const w of words) {
    if (POSITIVE.has(w)) pos++;
    else if (NEGATIVE.has(w)) neg++;
  }
  return (pos - neg) / words.length;
}

function entities(text: string): string[] {
  if (!text) return [];
  const m = text.match(/\b[A-Z][a-zA-Z]{2,}\b/g) || [];
  return [...new Set(m)].slice(0, 5);
}

function enrich(it: Item): Item {
  const score = sentiment(it.title);
  return {
    ...it,
    sentiment_score: score,
    entities: entities(it.title),
    market_impact: Math.abs(score) > 0.05 ? "high" : "medium",
    region: it.region || "global",
    tier: it.tier || "public",
  };
}

const FEEDS = {
  irl: [
    { url: "https://feeds.reuters.com/reuters/topNews", source: "Reuters" },
    { url: "https://feeds.bbci.co.uk/news/world/rss.xml", source: "BBC" },
    { url: "https://feeds.npr.org/1001/rss.xml", source: "NPR" },
    { url: "https://www.ft.com/?format=rss", source: "Financial Times" },
    { url: "https://www.economist.com/finance-and-economics/rss.xml", source: "The Economist" },
    { url: "https://feeds.bloomberg.com/markets/news.rss", source: "Bloomberg Markets" },
    { url: "https://www.aljazeera.com/xml/rss/all.xml", source: "Al Jazeera" },
    // Independent journalists / Substack bloggers
    { url: "https://mattstoller.substack.com/feed", source: "Matt Stoller (BIG)" },
    { url: "https://doomberg.substack.com/feed", source: "Doomberg" },
    { url: "https://bariweiss.substack.com/feed", source: "Bari Weiss (Free Press)" },
    { url: "https://www.racket.news/feed", source: "Matt Taibbi (Racket)" },
    { url: "https://greenwald.substack.com/feed", source: "Glenn Greenwald" },
    { url: "https://andrewsullivan.substack.com/feed", source: "Andrew Sullivan" },
    { url: "https://noahpinion.substack.com/feed", source: "Noah Smith" },
  ],
  dark: [
    { url: "https://krebsonsecurity.com/feed/", source: "Krebs on Security" },
    { url: "https://www.bleepingcomputer.com/feed/", source: "BleepingComputer" },
    { url: "https://therecord.media/feed/", source: "The Record" },
    { url: "https://www.darkreading.com/rss.xml", source: "Dark Reading" },
    { url: "https://www.schneier.com/feed/atom/", source: "Bruce Schneier" },
    { url: "https://grahamcluley.com/feed/", source: "Graham Cluley" },
    { url: "https://www.troyhunt.com/rss/", source: "Troy Hunt" },
    { url: "https://taosecurity.blogspot.com/feeds/posts/default", source: "Richard Bejtlich (TaoSecurity)" },
    { url: "https://www.databreaches.net/feed/", source: "DataBreaches.net" },
    { url: "https://www.404media.co/rss/", source: "404 Media" },
  ],
  tech: [
    ...additionalTechFeeds,
    { url: "https://hnrss.org/frontpage", source: "Hacker News" },
    { url: "https://www.theverge.com/rss/index.xml", source: "The Verge" },
    { url: "https://techcrunch.com/feed/", source: "TechCrunch" },
    { url: "https://www.wired.com/feed/rss", source: "Wired" },
    { url: "https://arstechnica.com/feed/", source: "Ars Technica" },
    { url: "https://stratechery.com/feed/", source: "Ben Thompson (Stratechery)" },
    { url: "https://www.platformer.news/feed", source: "Casey Newton (Platformer)" },
    { url: "https://daringfireball.net/feeds/main", source: "John Gruber (Daring Fireball)" },
    { url: "https://simonwillison.net/atom/everything/", source: "Simon Willison" },
    { url: "https://garymarcus.substack.com/feed", source: "Gary Marcus" },
    { url: "https://www.oneusefulthing.org/feed", source: "Ethan Mollick" },
    { url: "https://www.interconnects.ai/feed", source: "Nathan Lambert (Interconnects)" },
    { url: "https://thezvi.substack.com/feed", source: "Zvi Mowshowitz" },
  ],
};

// Tracked journalist Twitter/X handles — scraped via Nitter RSS (no API key).
// column: which news column to merge into. name: display label.
const TWITTER_JOURNALISTS: { handle: string; name: string; column: "irl" | "dark" | "tech" }[] = [
  // Crypto / markets
  { handle: "WuBlockchain",    name: "Wu Blockchain",     column: "irl" },
  { handle: "ianallison",      name: "Ian Allison",       column: "irl" },
  { handle: "laurashin",       name: "Laura Shin",        column: "irl" },
  { handle: "NickTimiraos",    name: "Nick Timiraos",     column: "irl" },
  { handle: "tracyalloway",    name: "Tracy Alloway",     column: "irl" },
  { handle: "lisaabramowicz1", name: "Lisa Abramowicz",   column: "irl" },
  { handle: "zerohedge",       name: "ZeroHedge",         column: "irl" },
  { handle: "DiMartinoBooth",  name: "Danielle DiMartino",column: "irl" },
  { handle: "Frances_Coppola", name: "Frances Coppola",   column: "irl" },
  { handle: "biancoresearch",  name: "Jim Bianco",        column: "irl" },
  // Geopolitics / IRL
  { handle: "MaxBlumenthal",   name: "Max Blumenthal",    column: "irl" },
  { handle: "aaronjmate",      name: "Aaron Maté",        column: "irl" },
  // Security / darknet intel
  { handle: "briankrebs",      name: "Brian Krebs",       column: "dark" },
  { handle: "campuscodi",      name: "Catalin Cimpanu",   column: "dark" },
  { handle: "vxunderground",   name: "vx-underground",    column: "dark" },
  { handle: "malwrhunterteam", name: "MalwareHunterTeam", column: "dark" },
  { handle: "GossiTheDog",     name: "Kevin Beaumont",    column: "dark" },
  // Tech / AI
  { handle: "swyx",            name: "swyx",              column: "tech" },
  { handle: "simonw",          name: "Simon Willison",    column: "tech" },
  { handle: "GaryMarcus",      name: "Gary Marcus",       column: "tech" },
  { handle: "emollick",        name: "Ethan Mollick",     column: "tech" },
  { handle: "karpathy",        name: "Andrej Karpathy",   column: "tech" },
];

const NITTER_INSTANCES = [
  "https://nitter.privacydev.net",
  "https://nitter.net",
  "https://nitter.poast.org",
  "https://nitter.cz",
  "https://nitter.tiekoetter.com",
];

const QUERY_TERMS = ["bitcoin","ethereum","crypto","fed","ecb","pboc","inflation","recession","rate"];


async function fetchFeeds(feeds: { url: string; source: string }[], health: SourceHealth[], signal: AbortSignal): Promise<Item[]> {
  const results = await Promise.allSettled(feeds.map(async f => {
    const r = await fetch(f.url, { headers: { "User-Agent": "VultureVision/1.0" }, signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]) });
    if (!r.ok) throw new Error(`${f.source} ${r.status}`);
    let sourceUrl: string | undefined;
    try { sourceUrl = new URL(f.url).origin; } catch { /* Retain last successful state on transient failure. */ }
    return parseRss(await r.text(), f.source, sourceUrl);
  }));
  results.forEach((result, i) => health.push({ source: feeds[i].source, status: result.status === "rejected" ? "unavailable" : result.value.length ? "available" : "empty", count: result.status === "fulfilled" ? result.value.length : 0 }));
  const items = results.flatMap(r => r.status === "fulfilled" ? r.value : []);
  items.sort(newestFirst);
  return items;
}

async function fetchNewsApi(health: SourceHealth[], signal: AbortSignal): Promise<Item[]> {
  const key = Deno.env.get("NEWS_API_KEY");
  if (!key) { health.push({ source: "NewsAPI", status: "not_configured", count: 0 }); return []; }
  const out: Item[] = [];
  let successes = 0;
  await Promise.allSettled(QUERY_TERMS.map(async (term) => {
    const u = new URL("https://newsapi.org/v2/everything");
    u.searchParams.set("q", term);
    u.searchParams.set("language", "en");
    u.searchParams.set("sortBy", "publishedAt");
    u.searchParams.set("pageSize", "5");
    try {
      const r = await fetch(u.toString(), { signal, headers: { "X-Api-Key": key } });
      if (!r.ok) return;
      const data = await r.json();
      if (data.status !== "ok") return;
      successes++;
      for (const art of (data.articles || []).slice(0, 5)) {
        const headline = art.title || "";
        if (!headline) continue;
        const link = safeNewsUrl(art.url);
        let source_url: string | undefined;
        try { source_url = link ? new URL(link).origin : undefined; } catch { /* Retain last successful state on transient failure. */ }
        out.push({
          title: headline.slice(0, 200),
          source: art.source?.name || "NewsAPI",
          time: publicationTime(art.publishedAt),
          link,
          journalist: art.author || undefined,
          source_url,
        });
      }
    } catch { /* Retain last successful state on transient failure. */ }
  }));
  health.push({ source: "NewsAPI", status: successes ? (out.length ? "available" : "empty") : "unavailable", count: out.length });
  return out;
}

async function fetchTorFeed(health: SourceHealth[], signal: AbortSignal): Promise<Item[]> {
  try {
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data, error } = await supa
      .from("tor_entries")
      .select("name,description,url,created_at,category")
      .order("created_at", { ascending: false })
      .limit(20).abortSignal(signal);
    if (error) throw new Error("Tor feed unavailable");
    health.push({ source: "TOR metadata", status: data?.length ? "available" : "empty", count: data?.length || 0 });
    return (data || []).map((r: {name:string;url:string;description?:string;category?:string;created_at:string;source?:string}) => ({
      title: (r.description || r.name || "").slice(0, 200),
      source: "TOR_FEED",
      time: r.created_at,
      link: r.url,
      region: "darknet",
      tier: "tor",
    })).filter(i => i.title);
  } catch { health.push({ source: "TOR metadata", status: "unavailable", count: 0 }); return []; }
}

async function fetchJournalistTweets(health: SourceHealth[], signal: AbortSignal): Promise<{ irl: Item[]; dark: Item[]; tech: Item[] }> {
  const out = { irl: [] as Item[], dark: [] as Item[], tech: [] as Item[] };
  await Promise.allSettled(TWITTER_JOURNALISTS.map(async (j, idx) => {
    // Rotate starting instance per handle to spread load
    const order = NITTER_INSTANCES.map((_, i) => NITTER_INSTANCES[(i + idx) % NITTER_INSTANCES.length]);
    for (const base of order) {
      if (signal.aborted) break;
      try {
        const url = `${base}/${j.handle}/rss`;
        const r = await fetch(url, {
          headers: { "User-Agent": "VultureVision/1.0 (+journalist-scraper)" },
          signal: AbortSignal.any([signal, AbortSignal.timeout(2500)]),
        });
        if (!r.ok) continue;
        const xml = await r.text();
        if (!xml.includes("<item") && !xml.includes("<entry")) continue;
        const items = parseRss(xml, `${j.name} (@${j.handle})`, `https://twitter.com/${j.handle}`)
          .slice(0, 5)
          .map(it => ({
            ...it,
            // Rewrite nitter links → twitter.com
            link: it.link?.replace(/^https?:\/\/[^/]+/, "https://twitter.com"),
            journalist: j.name,
            journalist_url: `https://twitter.com/${j.handle}`,
            source_url: `https://twitter.com/${j.handle}`,
          }));
        out[j.column].push(...items);
        health.push({ source: j.name + " (X/RSS)", status: items.length ? "available" : "empty", count: items.length });
        return; // success for this handle
      } catch { /* try next nitter instance */ }
    }
    health.push({ source: j.name + " (X/RSS)", status: "unavailable", count: 0 });
  }));
  return out;
}

async function fetchPublisherNews(req: Request, signal: AbortSignal, country?: string, page = 0, pageSize = 100) {
  const authorization = req.headers.get("authorization") || "";
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authorization }, fetch: (input, init) => fetch(input, { ...init, signal }) } });
  const { data: { user }, error: authError } = await db.auth.getUser();
  if (authError || !user) return { items: [], status: "sign_in_required" };
  let query = db.from("news_articles").select("id,title,original_title,translated_title_en,translation_status,translation_source_language,translated_at,source,canonical_url,published_at,fetched_at,source_country,language,source_id")
    .gte("fetched_at", new Date(Date.now() - 48 * 3600_000).toISOString())
    .or("published_at.is.null,published_at.gte." + new Date(Date.now() - 72 * 3600_000).toISOString())
    .order("published_at", { ascending: false, nullsFirst: false }).order("id").range(page * pageSize, page * pageSize + pageSize).abortSignal(signal);
  if (country) query = query.eq("source_country", country);
  const { data, error } = await query;
  if (error) return { items: [], status: "ingestion_not_available" };
  const eligible = (data || []).filter(row => {
    const language = (row.language || "").trim().toLowerCase().replace("_", "-");
    if (row.translated_title_en?.trim()) return true;
    if (row.translation_status === "original_english" || language === "en" || language.startsWith("en-")) return true;
    // Fail closed for CJK headlines until the translation worker has supplied English.
    return !/[\u2E80-\u2EFF\u3000-\u30FF\u3100-\u312F\u3130-\u318F\u31A0-\u31BF\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF]/u.test(row.title || "");
  });
  return { has_more: (data?.length || 0) > pageSize, items: eligible.slice(0,pageSize).map(row => ({ id: row.id, title: row.translated_title_en?.trim() || row.title, original_title:row.original_title||row.title, translated_title_en:row.translated_title_en, translation_status:row.translation_status, translation_source_language:row.translation_source_language, translated_at:row.translated_at, source: row.source, link: row.canonical_url, time: row.published_at, fetched_at: row.fetched_at, source_country: row.source_country, language: row.language, source_id: row.source_id })), status: eligible.length ? "available" : data?.length ? "translation_pending" : "no_recent_articles" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const denied = await authorize(req); if (denied) return denied;
  if (req.method !== "GET" && req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
  let body: { country?: unknown; page?: unknown; publisher_only?: unknown } = {};
  if (req.method === "POST") {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > 1024) return new Response(JSON.stringify({ error: "News request too large" }), { status: 413, headers: corsHeaders });
    try { body = JSON.parse(raw); if (!body || typeof body !== "object") throw new Error(); }
    catch { return new Response(JSON.stringify({ error: "Invalid news request" }), { status: 400, headers: corsHeaders }); }
  }
  try {
    const selectedCountry = body.country || new URL(req.url).searchParams.get("country");
    const country = typeof selectedCountry === "string" && /^[A-Z]{2}$/.test(selectedCountry) ? selectedCountry : undefined;
    const signal = AbortSignal.timeout(12000);
    const page = typeof body.page === 'number' && Number.isInteger(body.page) ? Math.max(0, Math.min(10000, body.page)) : 0;
    if (body.publisher_only === true) {
      const publisher = await fetchPublisherNews(req, signal, country, page);
      return new Response(JSON.stringify({publisher_news:publisher.items,publisher_status:publisher.status,has_more:'has_more' in publisher && publisher.has_more,page}), {headers:{...corsHeaders,'Content-Type':'application/json'}});
    }
    const store=new WarmState();
    if(!country){const snapshot=await store.get('news_snapshot_v1');if(snapshot)return new Response(JSON.stringify(snapshot),{headers:{...corsHeaders,'Content-Type':'application/json'}});}
    const source_health: SourceHealth[] = [];
    const [irlRss, dark, tech, newsApi, tor, journalists, catalog_health] = await Promise.all([
      fetchFeeds(FEEDS.irl, source_health, signal),
      fetchFeeds(FEEDS.dark, source_health, signal),
      fetchFeeds(FEEDS.tech, source_health, signal),
      fetchNewsApi(source_health, signal),
      fetchTorFeed(source_health, signal),
      fetchJournalistTweets(source_health, signal),
      collectCatalog(req, signal).catch(() => []),
    ]);
    const publisher = await fetchPublisherNews(req, AbortSignal.timeout(5000), country, 0, 1000).catch(() => ({items:[],status:'ingestion_not_available'}));
    const categorized = {irl: [] as Item[], dark: [] as Item[], tech: [] as Item[]};
    for (const row of publisher.items) {
      const source = sourceCatalog.find(s => s.id === row.source_id);
      categorized[newsColumn(source?.category)].push({...row,time:row.time ?? undefined});
    }

    const irl = [...newsApi, ...irlRss, ...journalists.irl, ...categorized.irl]
      .sort(newestFirst)
      .map(enrich);

    const darkOut = [...dark, ...tor, ...journalists.dark, ...categorized.dark]
      .sort(newestFirst)
      .map(enrich);

    const techOut = [...tech, ...journalists.tech, ...categorized.tech]
      .sort(newestFirst)
      .map(enrich);

    const all = [...new Map([...irl, ...darkOut, ...techOut].map(item=>[item.link || item.title,item])).values()]
      .sort(newestFirst)
;

    source_health.push({ source: "Publisher database", status: publisher.status === "available" ? "available" : publisher.status === "no_recent_articles" ? "empty" : "unavailable", count: publisher.items.length });
    const usable = source_health.some(source => source.status === "available" || source.status === "empty") || publisher.status === "available" || publisher.status === "no_recent_articles";
    const status = !usable ? "unavailable" : source_health.some(source => source.status === "unavailable") ? "degraded" : "available";
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), backend = Deno.env.get('SUPABASE_URL');
    if (all.length && service && backend) {
      await createClient(backend,service).from('warm_state').upsert({key:'news_feed',value:all,expires_at:new Date(Date.now()+1800000).toISOString()},{onConflict:'key'});
    }
    const snapshotValue={ status, source_health, catalog_health, catalog_total: sourceCatalog.length, checked_at: new Date().toISOString(), irl, dark: darkOut, tech: techOut, news_feed: all, publisher_news: publisher.items, publisher_status: publisher.status, has_more: "has_more" in publisher && publisher.has_more };
    if(usable&&!country)await store.set('news_snapshot_v1',snapshotValue,45);
    return new Response(JSON.stringify(snapshotValue), {
      status: usable ? 200 : 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "News service unavailable", status: "unavailable", irl: [], dark: [], tech: [], news_feed: [] }), {
      status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
