export const MAX_SEED_BYTES=512*1024;
export const MAX_REQUEST_BYTES=768*1024;
export function validateSeedSize(seed:string) {
  if(!seed.trim())throw new Error('Seed document is empty');
  if(new TextEncoder().encode(seed).byteLength>MAX_SEED_BYTES)throw new Error('Seed document exceeds the 512 KiB limit');
}
