const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

interface Item { title: string; source: string; time: string; link?: string; }

const FEEDS = {
  irl: [
    { url: "https://feeds.reuters.com/reuters/topNews", source: "Reuters" },
    { url: "https://feeds.bbci.co.uk/news/world/rss.xml", source: "BBC" },
    { url: "https://feeds.npr.org/1001/rss.xml", source: "NPR" },
  ],
  dark: [
    { url: "https://krebsonsecurity.com/feed/", source: "Krebs" },
    { url: "https://www.bleepingcomputer.com/feed/", source: "BleepingComputer" },
    { url: "https://therecord.media/feed/", source: "The Record" },
    { url: "https://www.darkreading.com/rss.xml", source: "Dark Reading" },
  ],
  tech: [
    { url: "https://hnrss.org/frontpage", source: "HN" },
    { url: "https://www.theverge.com/rss/index.xml", source: "The Verge" },
    { url: "https://techcrunch.com/feed/", source: "TechCrunch" },
    { url: "https://www.wired.com/feed/rss", source: "Wired" },
  ],
};

function parseRss(xml: string, source: string): Item[] {
  const out: Item[] = [];
  const entryRe = /<(?:item|entry)[^>]*>([\s\S]*?)<\/(?:item|entry)>/g;
  let m: RegExpExecArray | null;
  while ((m = entryRe.exec(xml)) && out.length < 15) {
    const block = m[1];
    const t = block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
    const d = block.match(/<(?:pubDate|published|updated)[^>]*>([\s\S]*?)<\/(?:pubDate|published|updated)>/);
    const l = block.match(/<link[^>]*?>([\s\S]*?)<\/link>/) || block.match(/<link[^>]*href="([^"]+)"/);
    const title = t ? t[1].replace(/<[^>]+>/g, "").trim() : "";
    if (!title) continue;
    const time = d ? new Date(d[1]).toISOString() : new Date().toISOString();
    out.push({ title, source, time, link: l ? l[1].trim() : undefined });
  }
  return out;
}

async function fetchFeeds(feeds: { url: string; source: string }[]): Promise<Item[]> {
  const results = await Promise.allSettled(feeds.map(async f => {
    const r = await fetch(f.url, { headers: { "User-Agent": "VultureVision/1.0" } });
    if (!r.ok) throw new Error(`${f.source} ${r.status}`);
    const xml = await r.text();
    return parseRss(xml, f.source);
  }));
  const items = results.flatMap(r => r.status === "fulfilled" ? r.value : []);
  items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  return items.slice(0, 15);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const [irl, dark, tech] = await Promise.all([
      fetchFeeds(FEEDS.irl),
      fetchFeeds(FEEDS.dark),
      fetchFeeds(FEEDS.tech),
    ]);
    return new Response(JSON.stringify({ irl, dark, tech }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message), irl: [], dark: [], tech: [] }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
