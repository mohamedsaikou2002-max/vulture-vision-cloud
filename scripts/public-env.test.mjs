import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publicEnvironmentErrors} from './public-env.mjs';
const valid={VITE_SUPABASE_URL:'https://project.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_build_fixture'};
const jwt=role=>`header.${Buffer.from(JSON.stringify({role})).toString('base64url')}.signature`;
test('accepts public keys and legacy anonymous keys',()=>{
 assert.deepEqual(publicEnvironmentErrors(valid),[]);
 assert.deepEqual(publicEnvironmentErrors({...valid,VITE_SUPABASE_PUBLISHABLE_KEY:jwt('anon')}),[]);
});
test('rejects service credentials and frontend provider secrets without echoing values',()=>{
 for(const key of ['sb_secret_do_not_print',jwt('service_role')]){
  const errors=publicEnvironmentErrors({...valid,VITE_SUPABASE_PUBLISHABLE_KEY:key});assert.ok(errors.length);assert.ok(!errors.join().includes(key));
 }
 assert.ok(publicEnvironmentErrors({...valid,VITE_GEMINI_API_KEY:'do_not_print'}).length);
});
test('rejects missing, mixed-project, insecure or credential-bearing configuration',()=>{
 assert.ok(publicEnvironmentErrors({}).length);
 assert.ok(publicEnvironmentErrors({...valid,VITE_SUPABASE_PROJECT_ID:'other-project'}).length);
 for(const url of ['http://project.supabase.co','https://user:password@project.supabase.co','https://project.supabase.co?token=x'])assert.ok(publicEnvironmentErrors({...valid,VITE_SUPABASE_URL:url}).length);
 assert.ok(publicEnvironmentErrors({...valid,VITE_VOICE_HOST:'http://localhost:8090'}).length);
});
