/**
 * WarWatch.World is an independent, open-source conflict aggregator.
 *
 * These are SECONDARY, date-only conflict annotations, never article evidence,
 * verified alerts, casualty counts, prices, or calibrated market observations.
 * WarWatch's /api/conflicts records do not provide canonical publisher URLs.
 * Do not insert them into news_articles or count them as independent sources.
 *
 * Upstream: https://github.com/nitinchhabria89/WarWatch.World (MIT)
 * No upstream code or source data is copied into this module.
 */
export const WARWATCH_URL = "https://warwatch.world/api/conflicts";
export const WARWATCH_HOME = "https://warwatch.world/";
export const WARWATCH_MAX_SIGNALS = 12;
const MAX_BYTES = 700_000;
const MAX_CONFLICTS = 100;
const RECENT_DAYS = 3; // upstream events are DATE-ONLY, not timestamped articles

export type WarWatchSignal = {
  id: string;
  conflict: string;
  countries: string[];
  severity: string;
  event_date: string;
  event: string;
  tags: string[];
  economic_channels: string[];
  source: "WarWatch.World";
  source_url: string;
  provenance: "secondary_unverified";
  time_precision: "day";
};

export type WarWatchSnapshot = {
  status: "available" | "stale" | "unavailable" | "disabled";
  checked_at: string;
  source: "WarWatch.World";
  source_url: string;
  signals: WarWatchSignal[];
  note: string;
};

const asRecord = (v: unknown): Record<string, unknown> | null =>
  v !== null && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : null;
const clean = (v: unknown, limit: number): string =>
  typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, limit) : "";
const distinct = (v: unknown, max: number, length: number): string[] =>
  Array.isArray(v) ? [...new Set(v.map(x => clean(x, length)).filter(Boolean))].slice(0, max) : [];
const exactDay = (v: unknown): string | null => {
  const date = clean(v, 20);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const time = Date.parse(date + "T00:00:00Z");
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === date ? date : null;
};

/** Hypothesized economic *channels* based on reported tags, never measured impact. */
export function economicTransmissionChannels(tags: string[], event: string): string[] {
  const body = [tags.join(" "), event].join(" ").toLowerCase();
  const channels: string[] = [];
  if (/oil|gas|fuel|energy|pipeline|refiner|power grid/.test(body)) channels.push("energy_supply");
  if (/ship|port|strait|freight|cargo|route|airspace|logistics/.test(body)) channels.push("transport_logistics");
  if (/sanction|embargo|tariff|export control|trade restrict/.test(body)) channels.push("trade_finance");
  if (/refugee|displac|humanitarian|evacuat/.test(body)) channels.push("migration_labor");
  if (/ceasefire|negotiat|diploma|election|policy/.test(body)) channels.push("policy_uncertainty");
  if (/military|war|strike|missile|armed|conflict/.test(body)) channels.push("regional_security");
  return channels.slice(0, 4);
}

const note = "Secondary conflict annotations from an external aggregator; date-only, independently unverified and not original news articles. Economic channels are hypotheses, not measured effects.";

export function normalizeWarWatch(payload: unknown, now = Date.now()): WarWatchSnapshot {
  const checked_at = new Date(now).toISOString();
  if (!Array.isArray(payload) || payload.length > MAX_CONFLICTS) throw new Error("Invalid WarWatch payload");
  const cutoff = new Date(now - RECENT_DAYS * 86_400_000).toISOString().slice(0, 10);
  const today = checked_at.slice(0, 10);
  const found: WarWatchSignal[] = [];
  const seen = new Set<string>();
  for (const raw of payload) {
    const row = asRecord(raw);
    if (!row) continue;
    const id = clean(row.id, 90);
    const conflict = clean(row.name, 140);
    if (!id || !conflict || !/^[a-zA-Z0-9_-]{2,90}$/.test(id)) continue;
    const countries = distinct(row.countries, 8, 70);
    const severity = clean(row.severity, 32);
    const events = Array.isArray(row.events) ? row.events.slice(0, 12) : [];
    let perConflict = 0;
    for (const eventRaw of events) {
      const e = asRecord(eventRaw);
      if (!e) continue;
      const date = exactDay(e.date);
      const event = clean(e.description, 240);
      if (!date || date < cutoff || date > today || !event) continue;
      const key = id + ":" + date + ":" + event.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const tags = distinct(e.tags, 6, 35);
      found.push({
        id: key.slice(0, 240), conflict, countries, severity, event_date: date,
        event, tags, economic_channels: economicTransmissionChannels(tags, event),
        source: "WarWatch.World", source_url: WARWATCH_HOME,
        provenance: "secondary_unverified", time_precision: "day",
      });
      if (++perConflict >= 2) break;
    }
  }
  found.sort((a, b) => b.event_date.localeCompare(a.event_date) || a.conflict.localeCompare(b.conflict));
  const signals = found.slice(0, WARWATCH_MAX_SIGNALS);
  return { status: signals.length ? "available" : "stale", source: "WarWatch.World",
    source_url: WARWATCH_HOME, checked_at, signals, note };
}

export const emptyWarWatch = (status: WarWatchSnapshot["status"], now = Date.now()): WarWatchSnapshot => ({
  status, checked_at: new Date(now).toISOString(), source: "WarWatch.World",
  source_url: WARWATCH_HOME, signals: [], note,
});

/** Hard-coded HTTPS endpoint, no user-controlled URLs or secret credentials. */
export async function fetchWarWatch(signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<WarWatchSnapshot> {
  if (typeof Deno !== "undefined" && Deno.env.get("WARWATCH_ENABLED") === "false") return emptyWarWatch("disabled");
  try {
    const timeout = AbortSignal.timeout(6500);
    const response = await fetcher(WARWATCH_URL, {
      method: "GET", redirect: "error",
      headers: { Accept: "application/json", "User-Agent": "VultureVisionNews/1.0" },
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    if (!response.ok) throw new Error("WarWatch unavailable");
    const length = Number(response.headers.get("content-length") || 0);
    if (length > MAX_BYTES) throw new Error("WarWatch response too large");
    const body = await response.text();
    if (body.length > MAX_BYTES) throw new Error("WarWatch response too large");
    return normalizeWarWatch(JSON.parse(body));
  } catch {
    return emptyWarWatch("unavailable");
  }
}

export function formatWarWatchForSwarm(signals: WarWatchSignal[]): string {
  return signals.slice(0, WARWATCH_MAX_SIGNALS).map(s =>
    [s.conflict, s.event_date + " (date only)", s.countries.join("/"),
      s.event, "Hypothesized transmission: " + (s.economic_channels.join(", ") || "unclassified"),
      "Origin: " + s.source_url + " (unverified secondary report)"].join(" | ")
  ).join("\n");
}
