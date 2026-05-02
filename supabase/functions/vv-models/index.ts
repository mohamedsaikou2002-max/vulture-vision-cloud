import "jsr:@std/dotenv/load";

Deno.serve(async () => {
  const key = Deno.env.get("ANTHROPIC_API_KEY")!;
  const r = await fetch("https://api.anthropic.com/v1/models", {
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
  });
  const j = await r.json();
  return new Response(JSON.stringify({ status: r.status, body: j }, null, 2), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
});
