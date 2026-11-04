import { describe, expect, it, vi } from 'vitest';
import {
  WARWATCH_URL, economicTransmissionChannels, emptyWarWatch, fetchWarWatch,
  normalizeWarWatch, formatWarWatchForSwarm,
} from '../../supabase/functions/_shared/warwatch';
import { buildCurrentSeed, type ScenarioBrief } from '../../supabase/functions/_shared/scenario_contract';
import { compileBackgroundPrompt } from '../../supabase/functions/_shared/live_context';

const now = Date.parse('2026-11-03T18:00:00Z');
const fixture = [{
  id: 'coastal-conflict', name: 'Coastal Conflict', countries: ['Country A', 'Country B'],
  severity: 'war', lastUpdated: '2026-11-03',
  events: [
    { date: '2026-11-03', description: 'Shipping port closure and possible energy disruption reported', tags: ['Military'] },
    { date: '2026-10-10', description: 'Old oil market alert', tags: ['Sanctions'] },
    { date: '2026-11-03', description: 'Shipping port closure and possible energy disruption reported', tags: ['Military'] },
  ],
}];

describe('WarWatch.World secondary conflict integration', () => {
  it('classifies date-only recent reports without inventing a measured market impact', () => {
    const result = normalizeWarWatch(fixture, now);
    expect(result.status).toBe('available');
    expect(result.signals).toHaveLength(1);
    expect(result.signals[0].provenance).toBe('secondary_unverified');
    expect(result.signals[0].time_precision).toBe('day');
    expect(result.signals[0].source_url).toBe('https://warwatch.world/');
    expect(result.signals[0].economic_channels).toContain('transport_logistics');
    expect(result.signals[0].economic_channels).toContain('energy_supply');
    expect(formatWarWatchForSwarm(result.signals)).toContain('unverified secondary report');
    expect(JSON.stringify(result)).not.toContain('Old oil market alert');
  });

  it('excludes stale, invalid and future dates rather than fabricating freshness', () => {
    expect(normalizeWarWatch([{...fixture[0],events:[{date:'2026-03-30',description:'Old report'}]}],now).status).toBe('stale');
    expect(normalizeWarWatch([{...fixture[0],events:[{date:'2026-11-33',description:'Invalid day'},{date:'2026-11-08',description:'Future claim'}]}],now).signals).toHaveLength(0);
    expect(() => normalizeWarWatch({events:[]}, now)).toThrow('Invalid');
  });

  it('avoids automatic numeric shock magnitudes or implied causal certainty', () => {
    expect(economicTransmissionChannels(['Diplomatic'], 'Negotiations began')).toEqual(['policy_uncertainty']);
    expect(economicTransmissionChannels([], 'A routine announcement')).toEqual([]);
  });

  it('degrades cleanly when the upstream endpoint is unavailable', async () => {
    const unavailable = await fetchWarWatch(undefined, vi.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch);
    expect(unavailable.status).toBe('unavailable');
    expect(unavailable.signals).toEqual([]);
    expect(emptyWarWatch('disabled').signals).toHaveLength(0);
  });

  it('requests only the fixed public HTTPS API and rejects oversized payloads', async () => {
    const mock = vi.fn().mockResolvedValue(new Response('[]', {status:200,headers:{'content-length':'900000'}}));
    const result = await fetchWarWatch(undefined, mock as unknown as typeof fetch);
    expect(mock).toHaveBeenCalledWith(WARWATCH_URL, expect.objectContaining({method:'GET',redirect:'error'}));
    expect(result.status).toBe('unavailable');
  });

  it('passes WarWatch annotations into frozen MiroFish seeds and precomputed prompts without treating them as headlines', () => {
    const geopolitical_signals = normalizeWarWatch(fixture,now).signals;
    const brief: ScenarioBrief = {
      snapshot_id:'test',as_of:new Date(now).toISOString(),expires_at:'2026-11-03T18:15:00Z',
      input_fingerprint:'test',
      inputs:{ objective:'Stress-test shipping disruption',capital:null,currency:'USD',horizon_days:30,risk_tolerance:'medium',exposures:'',constraints:'',alternatives:'' },
      news:[{id:'article1',title:'Publisher report',source:'Publisher',canonical_url:'https://example.com/story',source_country:'US',language:'en',published_at:'2026-11-03T17:00:00Z',fetched_at:'2026-11-03T17:01:00Z'}],
      geopolitical_signals, summary:'Review possible regional impacts',
      drivers:[{description:'Logistics uncertainty',source_ids:['article1']}],
      suggestions:[{title:'Logistics stress',prompt:'Evaluate routes',source_ids:['article1']}],
      comparison_options:['Baseline','Adverse'],evaluation_metrics:['Liquidity'],assumptions:['Conflict annotation is unverified'],
      coverage:{markets:['US'],articles:1,mode:'timestamped_headline_snapshot'},
    };
    const seed = buildCurrentSeed('A user scenario', brief,now);
    expect(seed).toContain('WarWatch.World conflict annotations');
    expect(seed).toContain('transport_logistics');
    expect(seed).toContain('secondary/unverified');
    expect(compileBackgroundPrompt(brief)).toContain('secondary geopolitical annotations');
    expect(brief.coverage.articles).toBe(1);
  });
});
