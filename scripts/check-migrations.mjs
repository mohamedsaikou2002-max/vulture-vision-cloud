import { PGlite } from '@electric-sql/pglite';
import { readFile,readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new PGlite();
try {
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; GRANT USAGE ON SCHEMA auth TO authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;`);
 for(const name of (await readdir('supabase/migrations')).filter(n=>n.endsWith('.sql')).sort())await db.exec(await readFile('supabase/migrations/'+name,'utf8'));
 const scalar=async(sql)=>(await db.query(sql)).rows[0];
 for(const table of ['warm_state','trade_history','synthesis_history','kill_switch_alerts']) {
  const row=await scalar(`SELECT has_table_privilege('anon','public.${table}','SELECT') AS anon_read,has_table_privilege('authenticated','public.${table}','SELECT') AS user_read,has_table_privilege('authenticated','public.${table}','INSERT') AS user_write`);
  assert.deepEqual(row,{anon_read:false,user_read:false,user_write:false});
 }
 await db.exec(`INSERT INTO news_articles(id,title,source,canonical_url,source_country,source_id,ingestion_method,published_at) VALUES('a','Development','Publisher','https://example.com/a','US','p','rss',now())`);
 const claim=(await db.query('SELECT * FROM claim_news_context()')).rows[0];assert.ok(claim.token);
 assert.equal((await db.query('SELECT * FROM claim_news_context()')).rows.length,0);
 await db.exec(`UPDATE news_articles SET title='New development' WHERE id='a'`);
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
 await db.exec('RESET ROLE');
 const owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
 await db.query('INSERT INTO auth.users(id) VALUES($1),($2)',[owner,other]);
 await db.exec('SET ROLE authenticated');
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[owner]);
 await db.query("INSERT INTO trade_lab_journal(engine_version,dataset_hash,decision_at,plan,result) VALUES('test',$1,now(),'{}','{}')",['a'.repeat(64)]);
 assert.equal((await db.query('SELECT * FROM trade_lab_journal')).rows.length,1);
 await assert.rejects(db.query("INSERT INTO trade_lab_journal(user_id,engine_version,dataset_hash,decision_at,plan,result) VALUES($1,'test',$2,now(),'{}','{}')",[other,'b'.repeat(64)]));
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[other]);
 assert.equal((await db.query('SELECT * FROM trade_lab_journal')).rows.length,0);
 await db.exec('SET ROLE anon');await assert.rejects(db.query('SELECT * FROM trade_lab_journal'));
 console.log('Migration checks passed including owner-isolated Trade Lab journal.');
} finally {await db.close();}
