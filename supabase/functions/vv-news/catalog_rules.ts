export type Column = 'irl' | 'dark' | 'tech';
export function newsColumn(category = ''): Column {
  return /security|cyber|dark/i.test(category) ? 'dark' : /tech|ai|science/i.test(category) ? 'tech' : 'irl';
}
export function robotsAllowed(text: string, path: string): boolean {
  const groups: {agents: string[]; rules: {allow: boolean; path: string}[]; delay: number}[] = [];
  let current = {agents: [] as string[], rules: [] as {allow: boolean; path: string}[], delay: 0};
  for (const line of text.split(/\r?\n/)) {
    const match = line.split('#')[0].match(/^\s*([\w-]+)\s*:\s*(.*?)\s*$/);
    if (!match) continue;
    const [, key, value] = match;
    if (key.toLowerCase() === 'user-agent') {
      if (current.rules.length || current.delay) {groups.push(current); current = {agents: [], rules: [], delay: 0};}
      current.agents.push(value.toLowerCase());
    } else if (/^(allow|disallow)$/i.test(key) && value) current.rules.push({allow: /^allow$/i.test(key), path: value});
    else if (/crawl-delay/i.test(key)) current.delay = Number(value) || 0;
  }
  groups.push(current);
  const explicit = groups.filter(g => g.agents.some(a => a !== '*' && 'vulturevisionnewsbot'.includes(a)));
  const selected = explicit.length ? explicit : groups.filter(g => g.agents.includes('*'));
  // Respect delayed sources conservatively rather than issuing a burst in a short-lived worker.
  if (selected.some(g => g.delay > 0)) return false;
  const matches = selected.flatMap(g => g.rules).filter(r => {
    const pattern = r.path.split('*').map(p => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*').replace(/\\\$$/, '$');
    return new RegExp('^' + pattern).test(path);
  }).sort((a,b) => b.path.length - a.path.length || Number(b.allow) - Number(a.allow));
  return matches[0]?.allow ?? true;
}
export function structuredHeadlines(html: string, base: string) {
  const items: {title: string; link: string; time?: string}[] = [];
  const visit = (value: unknown, depth = 0) => {
    if (depth > 12 || items.length >= 15) return;
    if (Array.isArray(value)) {value.slice(0,100).forEach(v => visit(v, depth+1)); return;}
    if (!value || typeof value !== 'object') return;
    const obj = value as Record<string, unknown>;
    const kinds = Array.isArray(obj['@type']) ? obj['@type'] : [obj['@type']];
    if (kinds.some(k => ['Article','NewsArticle','ReportageNewsArticle','BlogPosting'].includes(String(k))) && typeof obj.headline === 'string') {
      const page = obj.mainEntityOfPage;
      const link = typeof obj.url === 'string' ? obj.url : typeof page === 'string' ? page : page && typeof page === 'object' ? (page as Record<string,unknown>)['@id'] : undefined;
      if (typeof link === 'string') {try {items.push({title: obj.headline.replace(/<[^>]*>/g,'').slice(0,600), link: new URL(link,base).href, time: typeof obj.datePublished === 'string' ? obj.datePublished : undefined});} catch {/* Invalid metadata omitted. */}}
    }
    Object.values(obj).forEach(v => {if (typeof v === 'object') visit(v,depth+1);});
  };
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {visit(JSON.parse(match[1]));} catch {/* Invalid publisher JSON omitted. */}
  }
  return items;
}