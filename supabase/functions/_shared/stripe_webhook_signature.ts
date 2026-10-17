/** Stripe-Signature v1 validation on RAW webhook bytes. Enforce 5 minute timestamp tolerance. */
export async function isValidStripeSignature(
  raw: string, signature: string | null, secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): Promise<boolean> {
  if (!signature || !secret.startsWith("whsec_") || raw.length > 262144) return false;
  const parts = signature.split(",");
  const tPart = parts.find(v => v.trim().startsWith("t="));
  const timestamp = Number(tPart?.trim().slice(2));
  if (!Number.isSafeInteger(timestamp) || Math.abs(timestamp - nowSeconds) > 300) return false;
  const signatures = parts.filter(v => v.trim().startsWith("v1="))
    .map(v => v.trim().slice(3)).filter(v => /^[a-f0-9]{64}$/i.test(v));
  if (signatures.length === 0) return false;
  const encoder = new TextEncoder();
  const hmacKey = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const expected = new Uint8Array(await crypto.subtle.sign("HMAC", hmacKey, encoder.encode(timestamp + "." + raw)));
  let valid = false;
  for (const candidate of signatures) {
    const provided = Uint8Array.from(candidate.match(/.{2}/g) || [], h => parseInt(h, 16));
    if (provided.length !== expected.length) continue;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ provided[i];
    valid = valid || diff === 0;
  }
  return valid;
}
