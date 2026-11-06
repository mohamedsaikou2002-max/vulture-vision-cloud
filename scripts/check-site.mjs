// Run after a Netlify deploy: npm run check:site -- https://your-site.netlify.app
const input=process.argv[2];
let origin;
try {const url=new URL(input);if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||!(url.protocol==='https:'||(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname))))throw new Error();origin=url.origin;}
catch{console.error('Supply the deployed HTTPS site origin (or a local HTTP preview origin).');process.exit(1);}
const results=[];
for(const path of ['/','/welcome','/dashboard','/analytics','/socioeconomics','/news','/simulations','/simulations/simple','/research','/account']){
 try{
  const response=await fetch(origin+path,{signal:AbortSignal.timeout(12000)});const html=await response.text();
  results.push({path,result:response.ok&&/text\/html/.test(response.headers.get('content-type')||'')&&html.includes('id="root"')?'PASS':'BLOCKED',http:response.status});
  if(path==='/'){
   const asset=html.match(/src="(\/assets\/[^\"]+\.js)"/)?.[1];
   if(asset){const r=await fetch(origin+asset,{signal:AbortSignal.timeout(12000)});results.push({path:'Compiled JavaScript',result:r.ok&&/javascript/.test(r.headers.get('content-type')||'')&&/immutable/.test(r.headers.get('cache-control')||'')?'PASS':'BLOCKED',http:r.status});await r.body?.cancel();}
   else results.push({path:'Compiled JavaScript',result:'BLOCKED'});
  }
 }catch{results.push({path,result:'BLOCKED',detail:'Site unreachable or request timed out.'});}
}
for(const [path,expected] of [['/assets/nonexistent-release-check.js',404],['/images/nonexistent-release-check.png',404]]){
 try{const r=await fetch(origin+path,{signal:AbortSignal.timeout(12000)});results.push({path,result:r.status===expected?'PASS':'BLOCKED',http:r.status});await r.body?.cancel();}catch{results.push({path,result:'BLOCKED'});}
}
try{
 const r=await fetch(origin+'/video.mp4',{headers:{Range:'bytes=0-31'},signal:AbortSignal.timeout(12000)});
 results.push({path:'Original background video',result:[200,206].includes(r.status)&&/video\/mp4/.test(r.headers.get('content-type')||'')?'PASS':'BLOCKED',http:r.status});await r.body?.cancel();
}catch{results.push({path:'Original background video',result:'BLOCKED'});}
for(const row of results)console.log(JSON.stringify(row));
console.log('Static hosting checks do not exercise AI, database permissions, news ingestion or speech inference. Run check:backend separately.');
if(results.some(row=>row.result!=='PASS'))process.exitCode=1;
