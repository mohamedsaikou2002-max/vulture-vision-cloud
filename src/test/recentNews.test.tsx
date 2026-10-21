import {render,screen,cleanup} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {transferableAbortController} from 'node:util';
const {rows}=vi.hoisted(()=>({rows:[] as Record<string,unknown>[]}));
vi.mock('@/integrations/supabase/client',()=>{
 const query={select:()=>query,gte:()=>query,order:()=>query,limit:()=>query,abortSignal:async()=>({data:rows,error:null})};
 const channel={on:()=>channel,subscribe:()=>channel};
 return {supabase:{from:()=>query,channel:()=>channel,removeChannel:vi.fn()}};
});
import RecentNews from '@/components/sim/RecentNews';
beforeEach(()=>{vi.stubGlobal('AbortSignal',transferableAbortController().signal.constructor);rows.length=0;});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('uses the displayed English translation in a news-seeded simulation',async()=>{
 rows.push({id:'a'.repeat(64),title:'Η κεντρική τράπεζα αυξάνει τα επιτόκια',translated_title_en:'Central bank raises interest rates',translation_status:'translated',language:'el',source:'Publisher',published_at:new Date().toISOString()});
 rows.push({id:'b'.repeat(64),title:'Unübersetzte Nachricht',language:'de',translation_status:'pending',source:'Other publisher',published_at:new Date().toISOString()});
 render(<MemoryRouter><RecentNews/></MemoryRouter>);
 const link=await screen.findByRole('link',{name:'Central bank raises interest rates'});
 const url=new URL(link.getAttribute('href')!,'https://example.invalid');
 expect(url.searchParams.get('scenario')).toBe('Explore the consequences of: Central bank raises interest rates');
 expect(url.searchParams.get('articles')).toBe('a'.repeat(64));
 expect(screen.queryByText('Unübersetzte Nachricht')).not.toBeInTheDocument();
});
