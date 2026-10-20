import { describe, expect, it } from "vitest";
import {
  parseSimulationChatRequest, buildSimulationChatPrompt,
  parseSimulationChatAnswer, availableGeminiModels, type SimulationChatRequest
} from "../../supabase/functions/_shared/simulation_chat_contract";

const ref = "a".repeat(64);
const input: SimulationChatRequest = {
  question: "What breaks the bull thesis?",
  scenario: "Assume a severe liquidity contraction.",
  mode: "panel", history: [],
  contextSummary: "Selected events concern banking liquidity.",
  asOf: "2026-10-16T12:00:00Z",
  news: [{ id: ref, title: "Regional liquidity headline", source: "Test outlet" }],
  report: "", runStatus: "not_started", round: 0,
};
const output = {
  answer: "The scenario is hypothetical; MiroFish has not run.",
  specialists: [
    { role: "bull", position: "Liquidity recovers", reasoning: "Test credit spreads" },
    { role: "bear", position: "Funding runs dry", reasoning: "Stress rollover risk" },
    { role: "macro", position: "Policy response matters", reasoning: "Evaluate rate paths" },
    { role: "risk", position: "Define max drawdown", reasoning: "Bound the exposure" },
  ],
  disagreements: ["Policy effectiveness"],
  missing_evidence: ["Funding curve data"],
  experiments: ["Re-run with tighter liquidity"],
  evidence_ids: [ref, "invented-source"],
};
describe("Podroom-inspired Vulture simulation chat contract", () => {
  it("uses current Flash models by default and falls back when legacy models return 404", () => {
    expect(availableGeminiModels()).toEqual(["gemini-3.8-flash", "gemini-2.5-flash", "gemini-2.5-flash-lite"]);
    expect(availableGeminiModels("gemini-configured")).toEqual(["gemini-configured", "gemini-2.5-flash", "gemini-2.5-flash-lite"]);
    expect(availableGeminiModels("gemini-2.5-flash")).toHaveLength(2);
    expect(() => availableGeminiModels("../not-a-model")).toThrow("Invalid Gemini model");
  });
  it("accepts bounded scenario, role panel and news context", () => {
    expect(parseSimulationChatRequest(input)).toEqual(input);
  });
  it("treats attached data as untrusted and never asserts a run happened", () => {
    const prompt = buildSimulationChatPrompt(input);
    expect(prompt.system).toMatch(/untrusted context/);
    expect(prompt.system).toMatch(/do not execute transactions/i);
    expect(prompt.system).toMatch(/MiroFish results are unavailable/);
    expect(prompt.user).toContain("not_started");
    expect(prompt.user).toContain(input.question);
  });
  it("allows specialist single-role interrogation", () => {
    const role = parseSimulationChatAnswer(JSON.stringify(output), "bear", [ref], "gemini-2.5-flash");
    expect(role.specialists.map(x => x.role)).toEqual(["bear"]);
  });
  it("requires four distinct roles in panel mode", () => {
    const result = parseSimulationChatAnswer(JSON.stringify(output), "panel", [ref], "gemini-2.5-flash");
    expect(result.specialists).toHaveLength(4);
    expect(result.kind).toBe("model_synthesis");
  });
  it("drops fake evidence IDs instead of manufacturing sources", () => {
    const result = parseSimulationChatAnswer(JSON.stringify(output), "panel", [ref], "gemini-2.5-flash");
    expect(result.evidence_ids).toEqual([ref]);
  });
  it("rejects malformed response, missing requested role and false panel members", () => {
    expect(() => parseSimulationChatAnswer("nonsense", "panel", [], "gemini")).toThrow();
    expect(() => parseSimulationChatAnswer(JSON.stringify({ ...output, specialists: output.specialists.slice(0, 2) }), "panel", [], "gemini")).toThrow(/omitted panel/);
    expect(() => parseSimulationChatAnswer(JSON.stringify(output), "unknown" as never, [], "gemini")).toThrow();
  });
  it("prevents oversized messages, unbounded history, huge reports and unknown roles", () => {
    expect(() => parseSimulationChatRequest({ ...input, question: "x".repeat(1501) })).toThrow(/Question/);
    expect(() => parseSimulationChatRequest({ ...input, history: Array(9).fill({ role: "user", content: "message" }) })).toThrow(/8 turns/);
    expect(() => parseSimulationChatRequest({ ...input, report: "a".repeat(12001) })).toThrow(/report/i);
    expect(() => parseSimulationChatRequest({ ...input, mode: "sword" })).toThrow(/analyst selection/);
  });
  it("rejects synthetic source IDs in customer request and impossible rounds", () => {
    expect(() => parseSimulationChatRequest({ ...input, news: [{ id: "<script>", title: "Example", source: "Test" }] })).toThrow(/news id/i);
    expect(() => parseSimulationChatRequest({ ...input, round: 25 })).toThrow(/round/i);
  });
  it("won't treat unknown role as a valid specialist", () => {
    expect(() => parseSimulationChatAnswer(JSON.stringify({ ...output, specialists: [{ role: "trader", position: "Buy", reasoning: "none" }] }), "panel", [ref], "gemini")).toThrow(/requested analyst/);
  });
});
