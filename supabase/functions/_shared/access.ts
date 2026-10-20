import {membershipAccess} from './membership_access.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
export async function authorize(req: Request, operatorOnly=false): Promise<Response|null> {
  const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
  const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(service && token===service)return null; // Trusted server-to-server calls only.
  const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':'*'};
  if(!token)return new Response(JSON.stringify({error:'Sign in required'}),{status:401,headers});
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!);
  const {data:{user},error}=await db.auth.getUser(token);
  if(error || !user)return new Response(JSON.stringify({error:'Invalid session'}),{status:401,headers});
  const operators=(Deno.env.get('MIROFISH_ALLOWED_USER_IDS')||'').split(',').map(s=>s.trim());
  if(operatorOnly && !operators.includes(user.id))return new Response(JSON.stringify({error:'Operator access required'}),{status:403,headers});
  if(!operatorOnly){const admin=createClient(Deno.env.get('SUPABASE_URL')!,service!);return membershipAccess(admin,user.id);}
  return null;
}
