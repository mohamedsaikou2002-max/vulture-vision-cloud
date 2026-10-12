import { describe, expect, it } from 'vitest';
import { buildCurrentSeed, buildEvaluationRequirement, parseCapitalInputs, validateModelBrief, type ScenarioBrief } from '../../supabase/functions/_shared/scenario_contract';
const inputs = { objective:'Preserve liquidity', capital:100000, currency:'USD', horizon_days:30, risk_tolerance:'low', exposures:'Cash', constraints:'Maintain reserves', alternatives:'Keep cash or reduce exposures' };
const news = [{ id:'n1', title:'A central bank announces a policy change', source:'Publisher', canonical_url:'https://example.com/story', source_country:'GB', language:'en', published_at:'2026-10-12T03:00:00Z', fetched_at:'2026-10-12T03:30:00Z' }];
const model = { summary:'Explore policy effects',drivers:[{description:'Policy uncertainty',source_ids:['n1']}],suggestions:[{title:'Policy shock',prompt:'Compare liquidity effects',source_ids:['n1']}],comparison_options:['Hold','Reduce exposure'],evaluation_metrics:['Liquidity'],assumptions:['No live prices supplied'] };
describe('Current-event scenarios', () => {
  it('rejects invalid capital and horizon instead of inventing inputs', () => {
    expect(() => parseCapitalInputs({...inputs,capital:-1})).toThrow('capital');
    expect(() => parseCapitalInputs({...inputs,horizon_days:0})).toThrow('horizon');
    expect(parseCapitalInputs({...inputs,capital:null}).capital).toBeNull();
  });
  it('rejects model references absent from the news snapshot', () => {
    expect(() => validateModelBrief({...model,drivers:[{description:'Claim',source_ids:['invented']}]},news)).toThrow('Unverified');
    expect(validateModelBrief(model,news).comparison_options).toHaveLength(2);
  });
  it('freezes evidence, user constraints and comparison criteria into the seed', () => {
    const brief = {...model,inputs:parseCapitalInputs(inputs),news,snapshot_id:'snap',as_of:'2026-10-12T03:30:00Z',expires_at:'2026-10-12T03:45:00Z',input_fingerprint:'hash',coverage:{markets:['GB'],articles:1,mode:'snapshot'}} satisfies ScenarioBrief;
    const seed=buildCurrentSeed('A new decision',brief,Date.parse('2026-10-12T03:31:00Z'));
    expect(seed).toContain('https://example.com/story');expect(seed).toContain('Maintain reserves');expect(seed).toContain('Candidate decisions');expect(buildEvaluationRequirement('Decision',brief)).toContain('Preserve liquidity');
    expect(() => buildCurrentSeed('A new decision',brief,Date.parse('2026-10-12T03:46:00Z'))).toThrow('expired');
  });
});
