import { PGlite } from '@electric-sql/pglite';
import { readFile,readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new PGlite();
try {
 await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);');
 for(const name of (await readdir('supabase/migrations')).filter(n=>n.endsWith('.sql')).sort())await db.exec(await readFile('supabase/migrations/'+name,'utf8'));
 const scalar=async(sql)=>(await db.query(sql)).rows[0];
 for(const table of ['warm_state','trade_history','synthesis_history','kill_switch_alerts']) {
  const row=await scalar(`SELECT has_table_privilege('anon','public.${table}','SELECT') AS anon_read,has_table_privilege('authenticated','public.${table}','SELECT') AS user_read,has_table_privilege('authenticated','public.${table}','INSERT') AS user_write`);
  assert.deepEqual(row,{anon_read:false,user_read:false,user_write:false});
 }
 await db.exec("INSERT INTO news_articles(id,title,source,canonical_url,source_country,source_id,ingestion_method,published_at) VALUES('a','Development','Publisher','https://example.com/a','US','p','rss',now())");
 const claim=(await db.query('SELECT * FROM claim_news_context()')).rows[0];assert.ok(claim.token);
 assert.equal((await db.query('SELECT * FROM claim_news_context()')).rows.length,0);
 await db.exec("UPDATE news_articles SET title='New development' WHERE id='a'");
 const revision=await scalar('SELECT revision FROM news_context_queue');assert.ok(revision.revision>claim.source_revision);
 await db.query('SELECT finish_news_context($1,$2,$3::jsonb,NULL)',[claim.token,claim.source_revision,JSON.stringify({expires_at:new Date(Date.now()+900000).toISOString()})]);
 assert.equal((await scalar("SELECT (news_context_status()->>'pending')::boolean AS pending")).pending,true);
 await db.exec("UPDATE news_context_queue SET last_attempt=now()-interval '61 seconds'");
 const second=(await db.query('SELECT * FROM claim_news_context()')).rows[0];assert.ok(second.token);
 await db.query('SELECT finish_news_context($1,$2,NULL,$3)',[second.token,second.source_revision,'Generation failed']);
 assert.equal((await scalar('SELECT count(*)::integer AS n FROM news_prompt_versions')).n,1);
 await db.exec("UPDATE news_context_queue SET last_attempt=now()-interval '61 seconds';UPDATE news_context_budget SET attempts=60");
 assert.equal((await scalar("SELECT news_context_status()->>'status' AS status")).status,'budget_exhausted');
 assert.equal((await db.query('SELECT * FROM claim_news_context()')).rows.length,0);
 await db.exec('SET ROLE authenticated');
 assert.ok((await db.query('SELECT news_context_status()')).rows.length);
 await assert.rejects(db.query('SELECT * FROM news_context_queue'));
 await assert.rejects(db.query('SELECT * FROM claim_news_context()'));
 await db.exec("RESET ROLE; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$; GRANT USAGE ON SCHEMA auth TO authenticated;");
 // Staged SQL is exercised only in this disposable database, never activated remotely by this test.
 for(const name of (await readdir('drizzle/migrations')).filter(n=>n.endsWith('.sql')).sort())await db.exec(await readFile('drizzle/migrations/'+name,'utf8'));
 const userA='00000000-0000-4000-8000-000000000001',userB='00000000-0000-4000-8000-000000000002';
 const jobA='00000000-0000-4000-8000-000000000003',jobB='00000000-0000-4000-8000-000000000004';
 const claimAutoSim=async(user,job,parent=null)=>(await db.query('SELECT vv_claim_autosim($1,$2,$3,$4,1) AS outcome',[user,job,'Local staged migration test',parent])).rows[0].outcome;
 assert.equal(await claimAutoSim(userA,jobA),'claimed');assert.equal(await claimAutoSim(userA,jobA),'existing');assert.equal(await claimAutoSim(userA,jobB),'quota_exceeded');assert.equal(await claimAutoSim(userB,jobB,jobA),'invalid_parent');
 await db.exec(`INSERT INTO subscriptions(user_id,status,current_period_end) VALUES ('${userA}','active',now()+interval '1 day'),('${userB}','active',now()+interval '1 day')`);

 await db.query('INSERT INTO auth.users(id) VALUES($1),($2),($3)',[userA,userB,'00000000-0000-4000-8000-000000000099']);
 await db.query('INSERT INTO billing_customers(user_id,stripe_customer_id) VALUES($1,$2)',[userA,'cus_test_a']);
 const checkoutUser='00000000-0000-4000-8000-000000000099';
 const checkout=async(id)=>(await db.query('SELECT vv_claim_checkout($1,$2) AS value',[checkoutUser,id])).rows[0].value;
 const firstCheckout=await checkout(jobA);assert.equal((await checkout(jobB)).request_id,firstCheckout.request_id);
 const billingState={customer:'cus_test_a',subscription:'sub_a',status:'active',price:'price_monthly',period_end:new Date(Date.now()+86400000).toISOString(),trial_end:null,cancel_at_period_end:false};
 const billing=async(event,created,snapshot)=>(await db.query('SELECT vv_apply_billing_event($1,$2,$3,$4::jsonb) AS result',[event,created,userA,JSON.stringify(snapshot)])).rows[0].result;
 assert.equal(await billing('evt_1',100,billingState),'applied');assert.equal(await billing('evt_1',100,billingState),'duplicate');
 assert.equal(await billing('evt_old',99,{...billingState,status:'past_due'}),'stale');
 assert.equal(await billing('evt_cancel',101,{...billingState,status:'canceled'}),'applied');
 assert.equal(await billing('evt_equal_old',101,billingState),'stale');
 assert.equal((await db.query('SELECT vv_autosim_has_access($1) AS access',[userA])).rows[0].access,false);
 assert.equal(await billing('evt_new_sub',102,{...billingState,subscription:'sub_new'}),'applied');
 assert.equal(await billing('evt_old_sub_late',103,{...billingState,status:'canceled'}),'stale');
 await assert.rejects(billing('evt_forged',104,{...billingState,customer:'cus_other'}));
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[userA]);await db.exec('SET ROLE authenticated');
 assert.equal((await db.query('SELECT count(*)::integer AS n FROM autosim_jobs')).rows[0].n,1);
 assert.equal((await db.query('SELECT count(*)::integer AS n FROM subscriptions')).rows[0].n,1);
 await assert.rejects(db.query("UPDATE subscriptions SET status='active'"));
 await assert.rejects(db.query("UPDATE autosim_jobs SET status='completed'"));
 await assert.rejects(db.query('SELECT vv_claim_autosim($1,$2,$3,NULL,1)',[userA,jobB,'Forbidden client claim']));
 await assert.rejects(db.query('SELECT * FROM billing_customers'));
 await assert.rejects(db.query('SELECT vv_claim_checkout($1,$2)',[userA,jobB]));
 await assert.rejects(db.query('SELECT vv_apply_billing_event($1,$2,$3,$4::jsonb)',['forged',200,userA,JSON.stringify(billingState)]));
 console.log('Migration checks passed: billing duplicate/out-of-order events, customer binding, checkout claims;  existing permissions/context plus staged AutoSim ownership, claim replay, quotas and server-written membership.');
} finally {await db.close();}
