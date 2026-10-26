import {describe,it,expect,vi,beforeAll,afterAll} from 'vitest';
import {webcrypto} from 'node:crypto';
import {transferableAbortController} from 'node:util';
import {classifyRegime} from '../../supabase/functions/_shared/market_regime';
import {languageHint,parseTranslations,translationHash} from '../../supabase/functions/_shared/headline_translation';
import {loadEdgeHandler} from './helpers/edgeHarness';
beforeAll(()=>{vi.stubGlobal('crypto',webcrypto);vi.stubGlobal('AbortSignal',transferableAbortController().signal.constructor);});
afterAll(()=>vi.unstubAllGlobals());
describe('Production repair boundaries',()=>{
 it.each([
  ['El banco central sube los tipos','es','es'],['ارتفاع أسعار الفائدة','ar','ar'],['La banque relève les taux','fr','fr'],['Die Zentralbank erhöht die Zinsen','de','de'],['De rente stijgt','nl','nl'],['央行提高利率','zh','zh'],['中央銀行が金利を引き上げ','ja','ja'],['O banco aumenta os juros','pt','pt'],['Fed update: أسعار الفائدة rise','en','ar'],
 ])('preserves language detection hints for %s',(title,hint,language)=>{expect(languageHint(title,hint)).toBe(language);});
 it('caches normalized content and source language rather than mutable article IDs',async()=>{
  expect(await translationHash('Café','fr')).toBe(await translationHash('Cafe\u0301','fr'));expect(await translationHash('Bank','en')).not.toBe(await translationHash('Bank','de'));
 });
 it('rejects invented, duplicate and missing translation IDs',()=>{
  expect(()=>parseTranslations('{"translations":[{"id":"other","english":"Rates rise","language":"es"}]}',['real'])).toThrow();
  expect(()=>parseTranslations('{"translations":[]}',['real'])).toThrow();
  expect(parseTranslations('{"translations":[{"id":"real","english":"Rates rise","language":"es"}]}',['real'])[0].english).toBe('Rates rise');
 });
 it('calculates only a descriptive Nasdaq regime, without invented transition probabilities',()=>{
  const prices=Array.from({length:50},(_,i)=>100+i);const dates=prices.map((_,i)=>new Date(Date.now()-(49-i)*86400000).toISOString());
  const r=classifyRegime(prices,dates);expect(r.current_state).toBe('risk_on');expect(r.transition_probs_next_session).toEqual({});expect(r.observations_count).toBe(50);
  expect(classifyRegime([100],dates).status).toBe('insufficient_observations');expect(classifyRegime(prices,prices.map(()=> '2000-01-01')).status).toBe('stale');
 });
 it.each(['vv-trades','vv-killswitch','vv-mirofish','vv-tor-ingest','vv-synthesis'])('retains operator controls for %s',async name=>{
  const network=vi.fn();const handler=loadEdgeHandler(name,network,{SUPABASE_SERVICE_ROLE_KEY:'service'},()=>({}));
  const response=await handler(new Request('https://example.invalid',{method:'POST',body:'{}'}));
  expect(response.status).toBe(401);expect(network).not.toHaveBeenCalled();
 });
 it('bounds authenticated discovery search before calling its provider',async()=>{
  const network=vi.fn();const client={auth:{getUser:async()=>({data:{user:{id:'member'}},error:null})},rpc:async()=>({data:true,error:null})};
  const handler=loadEdgeHandler('vv-onion-search',network,{SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_ANON_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'service'},()=>client);
  const response=await handler(new Request('https://example.invalid',{method:'POST',headers:{authorization:'Bearer member'},body:JSON.stringify({q:'x'.repeat(500)})}));expect(response.status).toBe(400);expect(network).not.toHaveBeenCalled();
 });

});
