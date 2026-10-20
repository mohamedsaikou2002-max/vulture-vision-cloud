import type {SupabaseClient} from 'https://esm.sh/@supabase/supabase-js@2';
/** Explicit opt-in gate. Keep off until accepted billing configuration is verified. */
export async function membershipAccess(db:SupabaseClient,userId:string):Promise<Response|null>{
 if(Deno.env.get('VV_REQUIRE_SUBSCRIPTION')!=='true')return null;
 const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':'*'};
 const {data,error}=await db.rpc('vv_autosim_has_access',{p_user_id:userId});
 if(error)return new Response(JSON.stringify({error:'Subscription verification is unavailable'}),{status:503,headers});
 if(data!==true)return new Response(JSON.stringify({error:'An active membership is required. Manage your subscription on the membership page.'}),{status:402,headers});
 return null;
}
