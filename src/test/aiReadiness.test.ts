import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

describe("Vulture Gemini deployment readiness", () => {
  it("uses current Gemini model selection for both research chat functions", () => {
    const eagle = readFileSync("supabase/functions/vv-chat/index.ts", "utf8");
    const simulation = readFileSync("supabase/functions/vv-simulation-chat/index.ts", "utf8");
    expect(eagle).toContain("availableGeminiModels");
    expect(simulation).toContain("availableGeminiModels");
    expect(eagle).not.toContain("models/gemini-2.5-flash:generateContent");
    expect(eagle).toContain("r.status === 404");
    expect(simulation).toContain("upstream.status === 404");
  });
  it("never fakes an AI reply on provider failures", () => {
    const eagle = readFileSync("supabase/functions/vv-chat/index.ts", "utf8");
    const simulation = readFileSync("supabase/functions/vv-simulation-chat/index.ts", "utf8");
    expect(eagle).toContain("AI provider returned an empty response");
    expect(simulation).toContain("no simulation was fabricated");
  });
});
