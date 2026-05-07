// Normalizer — convert exchange payloads into a unified tick schema.
// Stateful: tracks last price per instrument to emit change_pct/direction.

export interface Tick {
  id: string;
  price: number;
  bid: number;
  ask: number;
  volume: number;
  ts_us: number;
  source: string;
  change_pct: number;
  direction: -1 | 0 | 1;
}

export type Source = "binance" | "bybit" | "oanda" | "alpaca";

export class Normalizer {
  private lastPrice: Record<string, number> = {};

  private enrich(t: Omit<Tick, "change_pct" | "direction">): Tick {
    const prev = this.lastPrice[t.id];
    let change_pct = 0;
    let direction: -1 | 0 | 1 = 0;
    if (prev && prev > 0 && t.price > 0) {
      change_pct = (t.price - prev) / prev;
      direction = change_pct > 1e-9 ? 1 : change_pct < -1e-9 ? -1 : 0;
    }
    if (t.price > 0) this.lastPrice[t.id] = t.price;
    return { ...t, change_pct, direction };
  }

  private nowUs(): number { return Date.now() * 1000; }

  normalizeBinance(raw: any): Tick | null {
    try {
      if (raw?.b != null && raw?.a != null && raw?.s) {
        const bid = parseFloat(raw.b), ask = parseFloat(raw.a);
        return this.enrich({
          id: raw.s, price: (bid + ask) / 2, bid, ask,
          volume: parseFloat(raw.B || "0") + parseFloat(raw.A || "0"),
          ts_us: this.nowUs(), source: "binance",
        });
      }
      if (raw?.c != null && raw?.s) {
        const price = parseFloat(raw.c);
        return this.enrich({
          id: raw.s, price,
          bid: parseFloat(raw.b ?? raw.c), ask: parseFloat(raw.a ?? raw.c),
          volume: parseFloat(raw.v || "0"),
          ts_us: (Number(raw.E) || Date.now()) * 1000,
          source: "binance",
        });
      }
    } catch { /* ignore */ }
    return null;
  }

  normalizeBybit(raw: any): Tick | null {
    try {
      let data = raw?.data;
      if (Array.isArray(data)) data = data[0];
      if (!data?.symbol) return null;
      const price = parseFloat(data.lastPrice ?? data.markPrice ?? "0");
      const bid = parseFloat(data.bid1Price ?? `${price}`);
      const ask = parseFloat(data.ask1Price ?? `${price}`);
      return this.enrich({
        id: data.symbol, price, bid, ask,
        volume: parseFloat(data.volume24h || "0"),
        ts_us: (Number(raw.ts) || Date.now()) * 1000,
        source: "bybit",
      });
    } catch { return null; }
  }

  normalizeOanda(raw: any): Tick | null {
    try {
      if (raw?.type !== "PRICE") return null;
      const bid = parseFloat(raw?.bids?.[0]?.price);
      const ask = parseFloat(raw?.asks?.[0]?.price);
      if (!raw.instrument || !bid || !ask) return null;
      return this.enrich({
        id: raw.instrument, price: (bid + ask) / 2, bid, ask,
        volume: 0, ts_us: this.nowUs(), source: "oanda",
      });
    } catch { return null; }
  }

  normalizeAlpaca(raw: any): Tick | null {
    try {
      const sym = raw?.S; if (!sym) return null;
      if (raw.T === "q") {
        const bid = Number(raw.bp || 0), ask = Number(raw.ap || 0);
        const price = bid && ask ? (bid + ask) / 2 : (bid || ask);
        return this.enrich({
          id: sym, price, bid, ask,
          volume: Number(raw.bs || 0) + Number(raw.as || 0),
          ts_us: this.nowUs(), source: "alpaca",
        });
      }
      if (raw.T === "t") {
        const price = Number(raw.p || 0);
        return this.enrich({
          id: sym, price, bid: price, ask: price,
          volume: Number(raw.s || 0),
          ts_us: this.nowUs(), source: "alpaca",
        });
      }
    } catch { /* ignore */ }
    return null;
  }

  normalizeAny(raw: any, source: Source | string): Tick | null {
    switch ((source || "").toLowerCase()) {
      case "binance": return this.normalizeBinance(raw);
      case "bybit":   return this.normalizeBybit(raw);
      case "oanda":   return this.normalizeOanda(raw);
      case "alpaca":  return this.normalizeAlpaca(raw);
      default: return null;
    }
  }
}
