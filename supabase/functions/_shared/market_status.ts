export interface MarketSource { source: string; status: 'available' | 'unavailable'; count: number; }
export function summarizeMarketStatus(prices: number, assets: number, sources: MarketSource[]) {
  if (!prices && !assets) return 'unavailable';
  if (!prices || !assets || sources.some(source => source.status !== 'available')) return 'degraded';
  return 'available';
}
