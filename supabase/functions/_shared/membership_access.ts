import type {SupabaseClient} from 'https://esm.sh/@supabase/supabase-js@2';
/** Release policy lives in the database; missing schema and verification errors fail closed. */
export async function membershipAccess(db:SupabaseClient,userId:string):Promise<Response|null>{
 const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':'*'};
 const {data,error}=await db.rpc('vv_workspace_access',{p_user_id:userId});
 if(error)return new Response(JSON.stringify({error:'Subscription verification is unavailable'}),{status:503,headers});
 if(data!==true)return new Response(JSON.stringify({error:'An active paid membership is required. Open the membership page to manage access.'}),{status:402,headers});
 return null;
}
