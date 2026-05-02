import { useEffect, useMemo, useState } from "react";
import VVLayout from "@/components/VVLayout";
import { supabase } from "@/integrations/supabase/client";

interface Entry {
  id: string;
  name: string;
  url: string;
  description: string | null;
  category: string;
  status: string;
  tags: string[] | null;
  ping_ms: number | null;
}

const FILTERS = [
  { id: "all", label: "ALL" },
  { id: "market", label: "MARKETS" },
  { id: "forum", label: "FORUMS" },
  { id: "search", label: "SEARCH" },
  { id: "news", label: "NEWS" },
  { id: "down", label: "OFFLINE" },
];

function tagFor(category: string, status: string) {
  if (status === "down") return { cls: "tag-red", label: "OFFLINE" };
  switch (category) {
    case "market": return { cls: "tag-gold", label: "MARKET" };
    case "forum":  return { cls: "tag-cyan", label: "FORUM" };
    case "search": return { cls: "tag-cyan", label: "SEARCH" };
    case "news":   return { cls: "tag-grey", label: "NEWS" };
    default:        return { cls: "tag-grey", label: category.toUpperCase() };
  }
}

export default function Onion() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Entry[] | null>(null);

  async function load() {
    const { data } = await supabase
      .from("tor_entries")
      .select("*")
      .order("created_at", { ascending: false });
    setEntries((data as Entry[]) || []);
  }

  useEffect(() => { load(); }, []);

  async function runSearch() {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearchResults([]);
    try {
      const { data } = await supabase.functions.invoke("vv-onion-search", { body: { q } });
      const items: Entry[] = (data?.results || []).map((r: any, i: number) => ({
        id: `live-${i}`,
        name: r.title || "Unknown Title",
        url: r.url,
        description: r.desc || "Live result from Ahmia .onion index",
        category: "search",
        status: "up",
        tags: ["live"],
        ping_ms: null,
      }));
      setSearchResults(items);
      setFilter("all");
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  const list: Entry[] = searchResults && searchResults.length >= 0 && query === "" ? entries : (searchResults ?? entries);

  const filtered = useMemo(() => {
    return list.filter(e => {
      if (filter === "all") return true;
      if (filter === "down") return e.status === "down";
      return e.category === filter;
    });
  }, [list, filter]);

  return (
    <VVLayout>
      <div className="scroll-inner">
        <div className="search-area">
          <div className="search-label">// ONION LINK INTELLIGENCE</div>
          <div className="search-row panel">
            <span className="search-icon">⬡</span>
            <input
              className="search-input"
              placeholder="Search .onion link, keyword, market name, or category..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") runSearch(); }}
              autoComplete="off"
            />
            <button className="search-btn" onClick={runSearch}>QUERY</button>
          </div>
          <div className="search-filters">
            {FILTERS.map(f => (
              <button
                key={f.id}
                className={`filter-btn${filter === f.id ? " active" : ""}`}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
            {searchResults !== null && (
              <button
                className="filter-btn"
                onClick={() => { setSearchResults(null); setQuery(""); }}
              >
                CLEAR LIVE
              </button>
            )}
          </div>
        </div>

        <div className="results-list">
          {searching && (
            <div className="result-item panel new-result">
              <div className="result-status unknown" />
              <div className="result-info">
                <div className="result-name">Querying: "{query}"</div>
                <div className="result-url">Scanning Tor index (Ahmia)...</div>
                <div className="result-desc">Live query in progress — results will populate</div>
              </div>
              <div className="result-meta"><span className="tag tag-cyan">LIVE</span><span className="result-ping">—</span></div>
            </div>
          )}
          {!searching && filtered.length === 0 && (
            <div className="result-item panel">
              <div className="result-info">No entries match.</div>
            </div>
          )}
          {filtered.map(e => {
            const t = tagFor(e.category, e.status);
            return (
              <div key={e.id} className="result-item panel">
                <div className={`result-status ${e.status}`} />
                <div className="result-info">
                  <div className="result-name">{e.name}</div>
                  <div className="result-url">{e.url}</div>
                  <div className="result-desc">{e.description}</div>
                </div>
                <div className="result-meta">
                  <span className={`tag ${t.cls}`}>{t.label}</span>
                  <span className="result-ping">{e.ping_ms ? `${e.ping_ms}ms` : "—"}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </VVLayout>
  );
}
