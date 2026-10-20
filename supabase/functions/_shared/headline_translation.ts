export function languageHint(title:string,hint?:string|null):string{
 if(/[\u0600-\u06ff]/u.test(title))return 'ar';
 if(/[\u3040-\u30ff]/u.test(title))return 'ja';
 if(/[\u3400-\u9fff]/u.test(title))return 'zh';
 if(/[\u0370-\u03ff]/u.test(title))return 'el';
 // Latin scripts need source metadata or provider detection; never guess English from ASCII.
 return hint?.toLowerCase().split(/[-_]/)[0]||'auto';
}
export async function translationHash(title:string,hint:string){
 const data=new TextEncoder().encode('headline-en-v1\u0000'+hint+'\u0000'+title.normalize('NFC'));
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data))).map(n=>n.toString(16).padStart(2,'0')).join('');
}
export function parseTranslations(text:string,ids:string[]):{id:string;english:string;language:string}[]{
 const value=JSON.parse(text.replace(/^```(?:json)?\s*/,'').replace(/```\s*$/,''));
 if(!Array.isArray(value.translations)||value.translations.length!==ids.length)throw new Error('Invalid translation batch');
 const seen=new Set<string>();
 return value.translations.map((r:{id:string;english:string;language:string})=>{
  if(!ids.includes(r.id)||seen.has(r.id)||typeof r.english!=='string'||!r.english.trim()||r.english.length>1200||typeof r.language!=='string'||!(/^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/).test(r.language))throw new Error('Invalid translation');seen.add(r.id);
  return {id:r.id,english:r.english.trim(),language:r.language};
 });
}
