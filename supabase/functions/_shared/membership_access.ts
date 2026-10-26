import type {SupabaseClient} from 'https://esm.sh/@supabase/supabase-js@2';
/** Identity verification only: the workspace never requires payment. */
export async function membershipAccess(db:SupabaseClient,userId:string):Promise<Response|null>{
 const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':'*'};
 const {data,error}=await db.rpc('vv_workspace_access',{p_user_id:userId});
 if(error)return new Response(JSON.stringify({error:'Workspace identity verification is unavailable'}),{status:503,headers});
 if(data!==true)return new Response(JSON.stringify({error:'Workspace session could not be verified'}),{status:403,headers});
 return null;
}
