import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {transferableAbortController} from 'node:util';
import {generateConfigured,generateGemini} from '../../supabase/functions/_shared/gemini';
beforeEach(()=>{vi.stubGlobal('AbortSignal',transferableAbortController().signal.constructor);vi.stubGlobal('Deno',{env:{toObject:()=>({LOVABLE_API_KEY:'fixture-gateway'}),get:(name:string)=>name==='LOVABLE_API_KEY'?'fixture-gateway':undefined}});});
afterEach(()=>vi.unstubAllGlobals());
it('uses the current default without legacy thinking settings',async()=>{
 const send=vi.fn(async(_input:unknown,_init?:RequestInit)=>Response.json({candidates:[{content:{parts:[{text:'{"summary":"Fixture"}'}]}}]}));
 await generateGemini('fixture',undefined,{contents:[],generationConfig:{responseMimeType:'application/json'}},send);
 expect(String(send.mock.calls[0][0])).toContain('/gemini-3.8-flash:generateContent');
 expect(JSON.parse(String(send.mock.calls[0][1].body)).generationConfig.thinkingConfig).toBeUndefined();
});
it('honors the simulation-specific fast gateway model',async()=>{
 const send=vi.fn(async(_input:unknown,_init?:RequestInit)=>Response.json({choices:[{message:{content:'{"summary":"Fixture"}'}}]}));vi.stubGlobal('fetch',send);
 await generateConfigured({contents:[],generationConfig:{responseMimeType:'application/json'}},1000,undefined,'google/gemini-2.5-flash-lite');
 expect(JSON.parse(String(send.mock.calls[0][1].body)).model).toBe('google/gemini-2.5-flash-lite');
});
it('does not mislabel immediate gateway connection failures as timeouts',async()=>{
 const send=vi.fn().mockRejectedValue(new TypeError('Private connection details'));vi.stubGlobal('fetch',send);
 await expect(generateConfigured({contents:[]},1000)).rejects.toMatchObject({code:'upstream',status:502,message:'AI gateway connection unavailable'});expect(send).toHaveBeenCalledTimes(1);
});
it('bounds hanging gateway requests and never launches another inference',async()=>{
 const send=vi.fn((_url:unknown,init:RequestInit)=>new Promise<Response>((_resolve,reject)=>{const signal=init.signal!;if(signal.aborted)reject(signal.reason);else signal.addEventListener('abort',()=>reject(signal.reason),{once:true});}));vi.stubGlobal('fetch',send);
 await expect(generateConfigured({contents:[]},50)).rejects.toMatchObject({code:'timeout',status:504});expect(send).toHaveBeenCalledTimes(1);
});
it('identifies timeout while reading a gateway response separately from malformed JSON',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(new ReadableStream({start(controller){controller.error(new DOMException('The operation timed out','TimeoutError'));}}))));
 await expect(generateConfigured({contents:[]},1000)).rejects.toMatchObject({code:'timeout',status:504,message:'AI request timed out while reading the answer'});
});
