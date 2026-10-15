import { describe,it,expect } from 'vitest';
import { parseInstruments,validateChatMessage } from '../../supabase/functions/_shared/request_limits';
describe('Provider input limits',()=>{
 it('deduplicates valid symbols and preserves defaults',()=>{expect(parseInstruments(' btcusdt,BTCUSDT,ethusdt',[])).toEqual(['BTCUSDT','ETHUSDT']);expect(parseInstruments(null,['EUR_USD'])).toEqual(['EUR_USD']);});
 it('rejects oversized and malformed instrument lists',()=>{expect(()=>parseInstruments(Array(21).fill('BTCUSDT').join(','),[])).toThrow();expect(()=>parseInstruments('BTCUSDT,https://example.com',[])).toThrow();expect(()=>parseInstruments('',[])).toThrow();});
 it('rejects empty and over-limit messages',()=>{expect(validateChatMessage(' hello ')).toBe('hello');expect(()=>validateChatMessage(' ')).toThrow();expect(()=>validateChatMessage('a'.repeat(8001))).toThrow();});
});
