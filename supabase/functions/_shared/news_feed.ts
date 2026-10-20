export interface FeedItem { title: string; source: string; time?: string; link?: string; journalist?: string; journalist_url?: string; source_url?: string; }
export function publicationTime(value?: string): string | undefined {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}T/.test(value) && !/(Z|[+-]\d{2}:?\d{2})$/i.test(value)) return undefined;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}
export function safeNewsUrl(value?: string): string | undefined {
  try { const url = new URL(value || ''); return /^https?:$/.test(url.protocol) && !url.username && !url.password ? url.href : undefined; }
  catch { return undefined; }
}
export function newestFirst(a: { time?: string | null }, b: { time?: string | null }) {
  return (Date.parse(b.time || '') || 0) - (Date.parse(a.time || '') || 0);
}
export interface SourceHealth { source: string; status: 'available' | 'empty' | 'unavailable' | 'not_configured'; count: number; }
export function parseRss(xml: string, source: string, sourceUrl?: string): FeedItem[] {
  if (!/<(?:rss|feed|rdf:RDF)\b/i.test(xml)) throw new Error("Source returned an invalid RSS/Atom feed");
  const out: FeedItem[] = [];
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
    const time = publicationTime(d?.[1]);
    let journalist: string | undefined;
    if (a) {
      const raw = a[1].replace(/<[^>]+>/g, "").trim();
      const nameMatch = raw.match(/<name[^>]*>([\s\S]*?)<\/name>/);
      journalist = (nameMatch ? nameMatch[1] : raw).replace(/.*?\(([^)]+)\).*/, "$1").trim() || undefined;
      if (journalist && journalist.length > 80) journalist = journalist.slice(0, 80);
    }
    const link = safeNewsUrl(l?.[1]);
    let journalist_url: string | undefined;
    if (journalist && link) {
      try {
        const origin = new URL(link).origin;
        journalist_url = `${origin}/search?q=${encodeURIComponent(journalist)}`;
      } catch { /* Retain last successful state on transient failure. */ }
    }
    out.push({ title, source, time, link, journalist, journalist_url, source_url: sourceUrl });
  }
  return out;
}

