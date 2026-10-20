import {authorize} from '../_shared/access.ts';
import {loadNasdaqCandles} from '../_shared/autosim_data.ts';
import {classifyRegime} from '../_shared/market_regime.ts';
import {WarmState} from '../_shared/warm_state.ts';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Content-Type':'application/json'};
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers});
 const denied=await authorize(req);if(denied)return denied;
 if(!['POST','GET'].includes(req.method))return new Response('{}',{status:405,headers});
 try{
  const store=new WarmState();const cached=await store.get('nasdaq_regime_v1');if(cached)return new Response(JSON.stringify(cached),{headers});
  const data=await loadNasdaqCandles();const regime=classifyRegime(data.closes,data.dates);
  await store.set('nasdaq_regime_v1',regime,120);
  return new Response(JSON.stringify(regime),{headers});
 }catch{return new Response(JSON.stringify({status:'provider_unavailable',error:'Nasdaq observations are unavailable'}),{status:503,headers});}
});
