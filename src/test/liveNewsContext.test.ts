import { describe, expect, it } from 'vitest';
import { compileBackgroundPrompt, personalizeContext, selectRecentEvidence, type LiveNewsContext } from '../../supabase/functions/_shared/live_context';
import { buildCurrentSeed } from '../../supabase/functions/_shared/scenario_contract';
const now=Date.parse('2026-10-12T04:00:00Z');
const article=(id:string,country:string,published='2026-10-12T03:30:00Z')=>({id,title:'Reported development '+id,source:'Publisher',canonical_url:'https://example.com/'+id,source_country:country,language:'en',published_at:published,fetched_at:'2026-10-12T03:40:00Z'});
const context:LiveNewsContext={snapshot_id:'revision-4',as_of:'2026-10-12T03:45:00Z',expires_at:'2026-10-12T04:10:00Z',input_fingerprint:'global',inputs:{objective:'Explore news',capital:null,currency:'USD',horizon_days:30,risk_tolerance:'medium',exposures:'',constraints:'',alternatives:''},news:[article('a','GB')],summary:'Policy changes reported',drivers:[{description:'Credit channel',source_ids:['a']}],suggestions:[{title:'Policy shock',prompt:'Explore effects',source_ids:['a']}],comparison_options:['Baseline','Adverse'],evaluation_metrics:['Liquidity'],assumptions:['No prices'],coverage:{markets:['GB'],articles:1,mode:'automatic'},background_prompt:'Prepared prompt'};
describe('Automatic global news context',()=>{
  it('selects across markets before adding more headlines from one country',()=>{
    const rows=[article('a','US'),article('b','US'),article('c','US'),article('d','JP')];
    expect(selectRecentEvidence(rows,now,2).map(n=>n.source_country)).toEqual(['US','JP']);
  });
  it('excludes stale or undated evidence and deduplicates links',()=>{
    const rows=[article('a','US'),article('a','US'),article('old','GB','2026-10-01T00:00:00Z'),{...article('unknown','JP'),published_at:null}];
    expect(selectRecentEvidence(rows,now)).toHaveLength(1);
  });
  it('prepares context before user input and personalizes without mutating the stored version',()=>{
    expect(compileBackgroundPrompt(context)).toContain('Await the user scenario');
    const personal=personalizeContext(context,{...context.inputs,capital:50000,objective:'Preserve cash',alternatives:'Maintain cash;Reduce exposure'});
    expect(personal.comparison_options).toEqual(['Maintain cash','Reduce exposure']);
    expect(personal.inputs.capital).toBe(50000);expect(context.inputs.capital).toBeNull();
    expect(buildCurrentSeed('My scenario',personal,now)).toContain('revision-4');
  });
});
