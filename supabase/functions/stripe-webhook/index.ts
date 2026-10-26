// Retired endpoint: old clients and Stripe retries must never initiate payments or writes.
const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info' };
Deno.serve(req => req.method === 'OPTIONS'
  ? new Response('ok', { headers })
  : new Response(JSON.stringify({ error: 'Billing has been removed. Workspace access is free.' }), { status: 410, headers }));
