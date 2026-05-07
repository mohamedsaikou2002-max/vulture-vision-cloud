// HotState — in-memory tick cache. Latest tick per instrument + rolling
// price history. Single-threaded JS, so no locking needed.

import type { Tick } from "./normalizer.ts";

export class HotState {
  static HISTORY_MAXLEN = 200;

  private latest: Record<string, Tick> = {};
  private history: Record<string, Array<[number, number]>> = {};
  readonly createdAtUs: number = Date.now() * 1000;

  update(tick: Tick | null | undefined): void {
    if (!tick || !tick.id) return;
    const iid = tick.id;
    this.latest[iid] = tick;
    const ring = (this.history[iid] ||= []);
    ring.push([tick.ts_us || 0, tick.price || 0]);
    if (ring.length > HotState.HISTORY_MAXLEN) ring.shift();
  }

  get(id: string): Tick | undefined { return this.latest[id]; }

  getAll(): Record<string, Tick> { return { ...this.latest }; }

  getHistory(id: string, n?: number): Array<[number, number]> {
    const h = this.history[id]; if (!h) return [];
    if (n == null || n >= h.length) return [...h];
    return h.slice(-n);
  }

  getSnapshot() {
    return {
      ts_us: Date.now() * 1000,
      instruments_count: Object.keys(this.latest).length,
      latest: { ...this.latest },
    };
  }

  instrumentsWithData(): number {
    return Object.keys(this.latest).length;
  }

  freshCount(maxAgeUs = 30_000_000): number {
    const now = Date.now() * 1000;
    return Object.values(this.latest).filter(t => now - (t.ts_us || 0) <= maxAgeUs).length;
  }
}
