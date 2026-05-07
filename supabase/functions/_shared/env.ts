// Startup validation — fail fast when required API keys are missing.
// Each edge function declares which keys it needs and calls validateEnv()
// at the top of its handler. Missing keys raise a clear error.

export type EnvRequirement = string | { name: string; optional?: boolean; hint?: string };

export class MissingEnvError extends Error {
  constructor(public missing: string[]) {
    super(`Missing required environment variables: ${missing.join(", ")}`);
    this.name = "MissingEnvError";
  }
}

export function validateEnv(required: EnvRequirement[]): Record<string, string> {
  const resolved: Record<string, string> = {};
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const r of required) {
    const name = typeof r === "string" ? r : r.name;
    const optional = typeof r === "string" ? false : !!r.optional;
    const v = Deno.env.get(name);
    if (v && v.length > 0) {
      resolved[name] = v;
    } else if (optional) {
      warnings.push(name);
    } else {
      missing.push(name);
    }
  }

  if (warnings.length) {
    console.warn(`[env] optional secrets not set: ${warnings.join(", ")}`);
  }
  if (missing.length) {
    console.error(`[env] STARTUP FAILURE — missing: ${missing.join(", ")}`);
    throw new MissingEnvError(missing);
  }
  return resolved;
}

// Wrap a Deno.serve handler so missing keys yield a clean 500 instead of a crash.
export function withEnv(
  required: EnvRequirement[],
  handler: (req: Request, env: Record<string, string>) => Promise<Response> | Response,
) {
  return async (req: Request): Promise<Response> => {
    try {
      const env = validateEnv(required);
      return await handler(req, env);
    } catch (e) {
      const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Content-Type": "application/json",
      };
      if (e instanceof MissingEnvError) {
        return new Response(
          JSON.stringify({ error: "configuration_error", missing: e.missing, message: e.message }),
          { status: 503, headers: corsHeaders },
        );
      }
      return new Response(
        JSON.stringify({ error: "internal_error", message: String((e as Error).message) }),
        { status: 500, headers: corsHeaders },
      );
    }
  };
}

// Common requirement bundles used across edge functions.
export const REQUIRES = {
  supabase: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as EnvRequirement[],
  anthropic: ["ANTHROPIC_API_KEY"] as EnvRequirement[],
  etherscan: ["ETHERSCAN_API_KEY"] as EnvRequirement[],
  newsApi: [{ name: "NEWS_API_KEY", optional: true }] as EnvRequirement[],
};
