import {loadEnv} from 'vite';
import {publicEnvironmentErrors} from './public-env.mjs';
const env=loadEnv('production',process.cwd(),'VITE_');
const problems=publicEnvironmentErrors(env);
if(problems.length){console.error(problems.join('\n'));process.exit(1);}
const base=env.VITE_SUPABASE_URL.replace(/\/$/,'');
const key=env.VITE_SUPABASE_PUBLISHABLE_KEY;
const checks=[
 {name:'Public simulation history',path:'/rest/v1/public_workspace_jobs?select=id&limit=0'},
 {name:'Translation schema',path:'/rest/v1/news_articles?select=id,translated_title_en,translation_status&limit=0'},
 {name:'Intel report',path:'/functions/v1/vv-intel-brief',body:{action:'latest'},verify:d=>!!d?.brief,empty:'No current report is available.'},
 {name:'Indexed news',path:'/functions/v1/vv-news',body:{publisher_only:true,page:0},verify:d=>Array.isArray(d?.publisher_news)&&d.publisher_news.length>0,empty:'No indexed English news is available.'},
 {name:'Economic world state',path:'/functions/v1/vv-autosim',body:{action:'world_state'},verify:d=>d?.ok===true,timeout:40000},
];
if(process.argv.includes('--ai'))checks.push({name:'Live Intel AI reply',path:'/functions/v1/vv-chat',body:{message:'In one sentence, explain what a hypothetical Nasdaq scenario is.',history:[]},verify:d=>typeof d?.reply==='string'&&d.reply.trim().length>0,timeout:55000});
const results=await Promise.all(checks.map(async check=>{
 const start=performance.now();
 try{
  const response=await fetch(base+check.path,{method:check.body?'POST':'GET',headers:{apikey:key,'Content-Type':'application/json'},body:check.body?JSON.stringify(check.body):undefined,signal:AbortSignal.timeout(check.timeout||15000)});
  const data=await response.json();
  const pass=response.ok&&(!check.verify||check.verify(data));
  const code=typeof data?.code==='string'?data.code:typeof data?.error?.code==='string'?data.error.code:undefined;
  return {check:check.name,result:pass?'PASS':'BLOCKED',http:response.status,milliseconds:Math.round(performance.now()-start),...(code?{code}:{}),...(!pass&&response.ok?{detail:check.empty||'Unexpected response contract.'}:{})};
 }catch{return {check:check.name,result:'BLOCKED',detail:'Request timed out or the service could not be reached.'};}
}));
for(const result of results)console.log(JSON.stringify(result));
console.log('Public checks do not prove publisher coverage, translation scheduling, external Whisper inference or all AI features. Use --ai for one actual inference request.');
if(results.some(result=>result.result!=='PASS'))process.exitCode=1;
