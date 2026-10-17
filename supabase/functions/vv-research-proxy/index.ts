// Subscriber-only gateway to optional Azure intel/socioeconomic backends.
// No browser-facing host URLs, sockets or backend tokens. Do not expose upstream ports publicly.
import { requirePaid } from "../_shared/paid_access.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = {
  "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Content-Type": "application/json",
};
const reply=(obj:unknown,status=200)=>new Response(JSON.stringify(obj),{status,headers:cors});
const paths = {
  "intel-brief": {base:"VV_INTEL_BACKEND_URL",path:"/brief/latest",method:"GET"},
  "intel-regime": {base:"VV_INTEL_BACKEND_URL",path:"/regime",method:"GET"},
  "intel-health": {base:"VV_INTEL_BACKEND_URL",path:"/health",method:"GET"},
  "intel-synthesize": {base:"VV_INTEL_BACKEND_URL",path:"/synthesize/now",method:"POST"},
  "socio-full": {base:"VV_SOCIO_BACKEND_URL",path:"/api/socioeconomics/full",method:"GET"},
  "socio-health": {base:"VV_SOCIO_BACKEND_URL",path:"/api/socioeconomics/health",method:"GET"},
} as const;
type Operation = keyof typeof paths;
Deno.serve(async req => {
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return reply({error:"Method not allowed"},405);
  const unpaid=await requirePaid(req);
  if(unpaid)return unpaid;
  let operation: Operation;
  try {
    const raw=await req.text();
    if(raw.length>512) return reply({error:"Payload too large"},413);
    const value=JSON.parse(raw)?.operation as string;
    if(!(value in paths))return reply({error:"Unsupported backend operation"},400);
    operation=value as Operation;
  } catch {return reply({error:"Invalid proxy request"},400);}
  if(operation==="intel-synthesize") {
    const jwt=(req.headers.get("authorization")||"").match(/^Bearer\s+(.+)$/i)?.[1];
    const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_ANON_KEY");
    if(!jwt||!url||!key)return reply({error:"Invalid account"},401);
    const db=createClient(url,key,{auth:{persistSession:false}});
    const {data:{user},error}=await db.auth.getUser(jwt);
    const operators=(Deno.env.get("MIROFISH_ALLOWED_USER_IDS")||"").split(",").map(s=>s.trim());
    if(error||!user||!operators.includes(user.id))return reply({error:"Operator access required"},403);
  }
  const config=paths[operation];
  const host=Deno.env.get(config.base);
  if(!host) return reply({error:"Research backend not configured"},503);
  let destination: URL;
  try{
    destination=new URL(host);
    if(destination.protocol!=="https:"||destination.username||destination.password||
       destination.search||destination.hash||destination.pathname!=="/")throw new Error();
    destination=new URL(config.path,destination.origin);
  }catch{return reply({error:"Invalid backend configuration"},503);}
  try{
    const upstream=await fetch(destination,{
      method:config.method,
      headers: {Accept:"application/json",...(Deno.env.get("VV_RESEARCH_BACKEND_TOKEN")?{Authorization:"Bearer "+Deno.env.get("VV_RESEARCH_BACKEND_TOKEN")}:{})},
      signal:AbortSignal.timeout(operation==="socio-full"?60000:15000),
    });
    if(!upstream.ok)return reply({error:"Research backend unavailable",backend_status:upstream.status},502);
    const txt=await upstream.text();
    if(txt.length>512000) return reply({error:"Research backend payload too large"},502);
    const body=JSON.parse(txt);
    return reply(body);
  }catch{return reply({error:"Research backend unavailable"},502);}
});
