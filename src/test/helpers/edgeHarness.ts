import { readFileSync } from 'node:fs';
import { resolve,dirname } from 'node:path';
import { createContext,runInContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
import * as ts from 'typescript';
export function loadEdgeHandler(name:string,fetcher:typeof fetch,values:Record<string,string>,createClient:()=>unknown) {
  let handler:(req:Request)=>Promise<Response>;
  const cache=new Map<string,Record<string,unknown>>();
  function load(file:string):Record<string,unknown>{
    if(cache.has(file))return cache.get(file)!;
    const exports={};cache.set(file,exports);
    const context=createContext({exports,console,URL,URLSearchParams,Request,Response,Headers,AbortSignal,TextEncoder,TextDecoder,Uint32Array,crypto:webcrypto,fetch:fetcher,
      Deno:{env:{get:(key:string)=>values[key],toObject:()=>({...values})},serve:(fn:typeof handler)=>{handler=fn;}},
      require:(specifier:string)=>{
        if(specifier==='npm:@supabase/supabase-js@2/cors')return {corsHeaders:{}};
        if(specifier.startsWith('https://esm.sh/@supabase/supabase-js'))return {createClient};
        return load(resolve(dirname(file),specifier));
      },
    });
    runInContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
    return exports;
  }
  load(resolve(process.cwd(),'supabase/functions',name,'index.ts'));
  return (req:Request)=>handler(req);
}
