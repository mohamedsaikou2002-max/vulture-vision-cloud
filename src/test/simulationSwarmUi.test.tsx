import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
const ask = vi.hoisted(() => vi.fn());
vi.mock("@/lib/simulationChatApi", () => ({ askSimulationResearch: ask }));
import SimulationSwarmChat from "@/components/SimulationSwarmChat";
const input = {
  scenario: "Credit crunch",
  contextSummary: "Macro tightening",
  asOf: "2026-10-16T00:00:00Z",
  news: [{id:"a".repeat(64),title:"Example report",source:"Test"}],
  report: "",
  runStatus: "not_started",
  round: 0,
  contextKey: "news:1",
};
const result = {
  answer: "This is exploratory only.",
  specialists: [{role:"bear",position:"Funding pressure",reasoning:"Stress capital calls"}],
  disagreements: [],missing_evidence: ["Historical liquidity data"],experiments:["Try a deeper shock"],
  evidence_ids:[], kind:"model_synthesis",model:"gemini-2.5-flash"
};
describe("simulation conversation room", () => {
  beforeEach(() => ask.mockReset());
  it("shows a research panel even without a completed MiroFish run", () => {
    render(<SimulationSwarmChat {...input}/>);
    expect(screen.getByText(/No completed MiroFish run attached/)).toBeTruthy();
    expect(screen.getByText(/works independently of the remote MiroFish engine/)).toBeTruthy();
  });
  it("sends analyst questions through Gemini and displays results", async () => {
    ask.mockResolvedValueOnce(result);
    render(<SimulationSwarmChat {...input}/>);
    fireEvent.click(screen.getByRole("button", {name:/BEAR.*Adversarial downside/i}));
    fireEvent.change(screen.getByRole("textbox",{name:"Ask the simulation panel"}),{target:{value:"Where does funding fail?"}});
    fireEvent.click(screen.getByRole("button",{name:/Send question/i}));
    await waitFor(() => expect(ask).toHaveBeenCalledOnce());
    expect(ask.mock.calls[0][0].mode).toBe("bear");
    expect(ask.mock.calls[0][0].runStatus).toBe("not_started");
    expect(await screen.findByText("This is exploratory only.")).toBeTruthy();
    expect(screen.getByText("Funding pressure")).toBeTruthy();
  });
  it("renders typed evidence-map coverage and falsifiable assumptions", async () => {
    ask.mockResolvedValueOnce({
      ...result,
      specialists: [{
        ...result.specialists[0],
        assumptions: ["Liquidity tightens"],
        invalidators: ["Bank funding spreads normalize"],
        evidence_ids: ["a".repeat(64)],
      }],
      interoperability: {
        schema_version: "vv.swarm.semantic.v1",
        linked_claims: 1,
        total_claims: 1,
        verification: "structure_and_source_ids_only",
        limitations: ["Source content is not independently verified."],
        claims: [], sources: [], edges: [],
      },
    });
    render(<SimulationSwarmChat {...input}/>);
    fireEvent.click(screen.getByRole("button", {name:/BEAR.*Adversarial downside/i}));
    fireEvent.change(screen.getByRole("textbox",{name:"Ask the simulation panel"}),{target:{value:"Test the evidence"}});
    fireEvent.click(screen.getByRole("button",{name:/Send question/i}));
    expect(await screen.findByText(/Liquidity tightens/)).toBeTruthy();
    expect(screen.getByText(/Bank funding spreads normalize/)).toBeTruthy();
    expect(screen.getByTestId("swarm-interoperability").textContent).toMatch(/1 of 1 analyst positions/);
  });
  it("reports provider errors without inventing a response", async () => {
    ask.mockRejectedValueOnce(new Error("Gemini is not configured"));
    render(<SimulationSwarmChat {...input}/>);
    fireEvent.change(screen.getByRole("textbox",{name:"Ask the simulation panel"}),{target:{value:"Test the scenario"}});
    fireEvent.click(screen.getByRole("button",{name:/Send question/i}));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Gemini is not configured");
    expect(screen.queryByText("Gemini moderator · conditional analysis")).toBeNull();
  });
});
