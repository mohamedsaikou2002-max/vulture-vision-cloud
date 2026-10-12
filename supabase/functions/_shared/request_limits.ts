export function parseInstruments(raw:string|null,defaults:string[]):string[] {
 if(raw===null)return defaults;
 if(raw.length>512)throw new Error('Instrument list is too large');
 const values=raw.split(',').map(s=>s.trim().toUpperCase());
 if(values.length>20 || values.some(s=>! /^[A-Z0-9_]{2,24}$/.test(s)))throw new Error('Provide 1–20 valid instrument symbols');
 return [...new Set(values)];
}
export function validateChatMessage(value:unknown):string {
 if(typeof value!=='string' || !value.trim() || value.length>8000)throw new Error('Message must contain 1–8000 characters');
 return value.trim();
}
