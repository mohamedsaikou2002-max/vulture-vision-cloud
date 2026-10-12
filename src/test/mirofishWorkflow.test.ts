import { beforeEach, describe, expect, it, vi } from "vitest";
const invoke = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));
import { buildSeed, prepareAndStart } from "@/lib/mirofishWorkflow";

describe("MiroFish integration", () => {
  beforeEach(() => invoke.mockReset());
  it("withholds outcome fields from the historical seed", () => {
    const event = { event_id: "secret-id", category: "bank_run", asset_class: "credit", trigger: "withdrawals", contagion_channels: "bank credit", policy_response: "SECRET-RESPONSE", magnitude_approx: "SECRET-OUTCOME", name: "SECRET-NAME" };
    const seed = buildSeed("New shock", event);
    expect(seed).toContain("withdrawals");
    expect(seed).not.toMatch(/SECRET-|secret-id/);
  });
  it("uses the upstream ontology, graph, prepare and start contracts in order", async () => {
    for (const data of [{ project_id: "p" }, { task_id: "g" }, { status: "completed" }, { simulation_id: "s" }, { task_id: "a" }, { status: "completed" }, { runner_status: "running" }]) invoke.mockResolvedValueOnce({ data: { success: true, data }, error: null });
    expect(await prepareAndStart("shock", "seed", 8, vi.fn(), vi.fn(), new AbortController().signal)).toBe("s");
    const paths = invoke.mock.calls.map(c => c[1].body.path);
    expect(paths).toEqual(["/api/graph/ontology/generate", "/api/graph/build", "/api/graph/task/g", "/api/simulation/create", "/api/simulation/prepare", "/api/graph/task/a", "/api/simulation/start"]);
    expect(invoke.mock.calls[6][1].body.payload.max_rounds).toBe(8);
  });
  it("stops preparation when the graph task fails", async () => {
    invoke.mockResolvedValueOnce({ data: { data: { project_id: "p" } } }).mockResolvedValueOnce({ data: { data: { task_id: "t" } } }).mockResolvedValueOnce({ data: { data: { status: "failed" } } });
    await expect(prepareAndStart("shock", "seed", 8, vi.fn(), vi.fn(), new AbortController().signal)).rejects.toThrow("preparation failed");
    expect(invoke).toHaveBeenCalledTimes(3);
  });
  it("resumes a saved running simulation without duplicate mutation calls",async()=>{
    const onId=vi.fn();
    invoke.mockResolvedValueOnce({data:{data:{status:'completed'}}});
    expect(await prepareAndStart('shock','seed',8,vi.fn(),onId,new AbortController().signal,{project_id:'p',graph_task_id:'g',simulation_id:'s',prepared_complete:true,started:true})).toBe('s');
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(onId).toHaveBeenCalledWith('s');
  });
  it("saves a mutation response before honoring cancellation",async()=>{
    const controller=new AbortController();const save=vi.fn();
    invoke.mockImplementationOnce(async()=>{controller.abort();return {data:{data:{project_id:'recover-me'}}};});
    await expect(prepareAndStart('shock','seed',8,vi.fn(),vi.fn(),controller.signal,{},save)).rejects.toMatchObject({name:'AbortError'});
    expect(save).toHaveBeenCalledWith({project_id:'recover-me'});
    expect(invoke).toHaveBeenCalledTimes(1);
  });

});
