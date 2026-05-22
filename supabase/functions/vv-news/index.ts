import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Item {
  title: string;
  source: string;
  time: string;
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

function parseRss(xml: string, source: string, sourceUrl?: string): Item[] {
  const out: Item[] = [];
  const entryRe = /<(?:item|entry)[^>]*>([\s\S]*?)<\/(?:item|entry)>/g;
  let m: RegExpExecArray | null;
  while ((m = entryRe.exec(xml)) && out.length < 15) {
    const block = m[1];
    const t = block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
    const d = block.match(/<(?:pubDate|published|updated)[^>]*>([\s\S]*?)<\/(?:pubDate|published|updated)>/);
    const l = block.match(/<link[^>]*?>([\s\S]*?)<\/link>/) || block.match(/<link[^>]*href="([^"]+)"/);
    const a = block.match(/<dc:creator[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/dc:creator>/)
           || block.match(/<author[^>]*>([\s\S]*?)<\/author>/);
    const title = t ? t[1].replace(/<[^>]+>/g, "").trim() : "";
    if (!title) continue;
    const time = d ? new Date(d[1]).toISOString() : new Date().toISOString();
    let journalist: string | undefined;
    if (a) {
      const raw = a[1].replace(/<[^>]+>/g, "").trim();
      const nameMatch = raw.match(/<name[^>]*>([\s\S]*?)<\/name>/);
      journalist = (nameMatch ? nameMatch[1] : raw).replace(/.*?\(([^)]+)\).*/, "$1").trim() || undefined;
      if (journalist && journalist.length > 80) journalist = journalist.slice(0, 80);
    }
    const link = l ? l[1].trim() : undefined;
    let journalist_url: string | undefined;
    if (journalist && link) {
      try {
        const origin = new URL(link).origin;
        journalist_url = `${origin}/search?q=${encodeURIComponent(journalist)}`;
      } catch {}
    }
    out.push({ title, source, time, link, journalist, journalist_url, source_url: sourceUrl });
  }
  return out;
}

async function fetchFeeds(feeds: { url: string; source: string }[]): Promise<Item[]> {
  const results = await Promise.allSettled(feeds.map(async f => {
    const r = await fetch(f.url, { headers: { "User-Agent": "VultureVision/1.0" } });
    if (!r.ok) throw new Error(`${f.source} ${r.status}`);
    let sourceUrl: string | undefined;
    try { sourceUrl = new URL(f.url).origin; } catch {}
    return parseRss(await r.text(), f.source, sourceUrl);
  }));
  const items = results.flatMap(r => r.status === "fulfilled" ? r.value : []);
  items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  return items.slice(0, 40);
}

async function fetchNewsApi(): Promise<Item[]> {
  const key = Deno.env.get("NEWS_API_KEY");
  if (!key) return [];
  const out: Item[] = [];
  await Promise.allSettled(QUERY_TERMS.map(async (term) => {
    const u = new URL("https://newsapi.org/v2/everything");
    u.searchParams.set("q", term);
    u.searchParams.set("language", "en");
    u.searchParams.set("sortBy", "publishedAt");
    u.searchParams.set("pageSize", "5");
    u.searchParams.set("apiKey", key);
    try {
      const r = await fetch(u.toString());
      if (!r.ok) return;
      const data = await r.json();
      for (const art of (data.articles || []).slice(0, 5)) {
        const headline = art.title || "";
        if (!headline) continue;
        const link = art.url;
        let source_url: string | undefined;
        try { source_url = link ? new URL(link).origin : undefined; } catch {}
        out.push({
          title: headline.slice(0, 200),
          source: art.source?.name || "NewsAPI",
          time: art.publishedAt || new Date().toISOString(),
          link,
          journalist: art.author || undefined,
          source_url,
        });
      }
    } catch {}
  }));
  return out;
}

async function fetchTorFeed(): Promise<Item[]> {
  try {
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data } = await supa
      .from("tor_entries")
      .select("name,description,url,created_at,category")
      .order("created_at", { ascending: false })
      .limit(20);
    return (data || []).map((r: any) => ({
      title: (r.description || r.name || "").slice(0, 200),
      source: "TOR_FEED",
      time: r.created_at,
      link: r.url,
      region: "darknet",
      tier: "tor",
    })).filter(i => i.title);
  } catch { return []; }
}

async function fetchJournalistTweets(): Promise<{ irl: Item[]; dark: Item[]; tech: Item[] }> {
  const out = { irl: [] as Item[], dark: [] as Item[], tech: [] as Item[] };
  await Promise.allSettled(TWITTER_JOURNALISTS.map(async (j, idx) => {
    // Rotate starting instance per handle to spread load
    const order = NITTER_INSTANCES.map((_, i) => NITTER_INSTANCES[(i + idx) % NITTER_INSTANCES.length]);
    for (const base of order) {
      try {
        const url = `${base}/${j.handle}/rss`;
        const r = await fetch(url, {
          headers: { "User-Agent": "VultureVision/1.0 (+journalist-scraper)" },
          signal: AbortSignal.timeout(8000),
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
        return; // success for this handle
      } catch { /* try next nitter instance */ }
    }
  }));
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const [irlRss, dark, tech, newsApi, tor, journalists] = await Promise.all([
      fetchFeeds(FEEDS.irl),
      fetchFeeds(FEEDS.dark),
      fetchFeeds(FEEDS.tech),
      fetchNewsApi(),
      fetchTorFeed(),
      fetchJournalistTweets(),
    ]);

    const irl = [...newsApi, ...irlRss, ...journalists.irl]
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 30)
      .map(enrich);

    const darkOut = [...dark, ...tor, ...journalists.dark]
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 30)
      .map(enrich);

    const techOut = [...tech, ...journalists.tech]
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 30)
      .map(enrich);

    const all = [...irl, ...darkOut, ...techOut]
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 80);

    return new Response(JSON.stringify({ irl, dark: darkOut, tech: techOut, news_feed: all }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message), irl: [], dark: [], tech: [], news_feed: [] }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

    const all = [...irl, ...darkOut, ...techOut]
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 50);

    return new Response(JSON.stringify({ irl, dark: darkOut, tech: techOut, news_feed: all }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message), irl: [], dark: [], tech: [], news_feed: [] }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
