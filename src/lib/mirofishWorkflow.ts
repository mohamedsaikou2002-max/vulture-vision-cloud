import { supabase } from "@/integrations/supabase/client";

export interface EngineState {
  runner_status: string; current_round: number; total_rounds: number;
  progress_percent: number; total_actions_count: number;
}
export async function engineCall(path: string, payload?: Record<string, unknown>, seed?: string) {
  const { data, error } = await supabase.functions.invoke("vv-simulation", {
    body: { path, method: payload ? "POST" : "GET", payload, seed },
  });
  if (error || data?.error) throw new Error(data?.error || error?.message || "Simulation request failed");
  return data?.data ?? data;
}
export function buildSeed(scenario: string, event?: { event_id: string; category: string; asset_class: string; trigger: string; contagion_channels: string }) {
  return [
    "# Vulture Vision exploratory scenario",
    "Scenario: " + scenario,
    "Actors: retail investors, banks, hedge funds, regulators, central banks, financial media.",
    "Analyze narrative spread, institutional reactions and possible contagion. Distinguish simulated behavior from observed market outcomes. Do not present scores as calibrated market probabilities.",
    event ? "Historical structural context (unverified, qualitative only):\n" + JSON.stringify({ category: event.category, asset_class: event.asset_class, trigger: event.trigger, contagion_channels: event.contagion_channels }) : "",
    "No historical outcome, realized magnitude, date or subsequent policy response is supplied. Anonymization does not guarantee elimination of model knowledge leakage.",
  ].filter(Boolean).join("\n\n");
}
async function waitTask(taskId: string, phase: (value: string) => void, signal: AbortSignal) {
  const deadline = Date.now() + 20 * 60 * 1000;
  while (Date.now() < deadline) {
    checkAbort(signal);
    const task = await engineCall("/api/graph/task/" + encodeURIComponent(taskId));
    checkAbort(signal);
    if (task.status === "failed") throw new Error("Engine preparation failed");
    if (task.status === "completed") return;
    phase("Preparing engine · " + (task.progress ?? 0) + "%");
    await new Promise<void>((resolve, reject) => {
      const abort = () => { clearTimeout(timer); reject(new DOMException("Stopped", "AbortError")); };
      const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, 3000);
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) abort();
    });
  }
  throw new Error("Preparation deadline exceeded");
}
export async function prepareAndStart(scenario: string, seed: string, rounds: number, phase: (value: string) => void, onId: (id: string) => void, signal: AbortSignal) {
  phase("Extracting entities");
  const project = await engineCall("/api/graph/ontology/generate", { simulation_requirement: scenario }, seed);
  checkAbort(signal);
  phase("Building memory graph");
  const graph = await engineCall("/api/graph/build", { project_id: project.project_id });
  await waitTask(graph.task_id, phase, signal);
  const sim = await engineCall("/api/simulation/create", { project_id: project.project_id, enable_twitter: true, enable_reddit: false });
  onId(sim.simulation_id);
  checkAbort(signal);
  phase("Generating agent profiles");
  const prepared = await engineCall("/api/simulation/prepare", { simulation_id: sim.simulation_id, parallel_profile_count: 2 });
  if (prepared.task_id) await waitTask(prepared.task_id, phase, signal);
  checkAbort(signal);
  await engineCall("/api/simulation/start", { simulation_id: sim.simulation_id, platform: "twitter", max_rounds: rounds, enable_graph_memory_update: false });
  checkAbort(signal);
  return sim.simulation_id as string;
}

export function checkAbort(signal: AbortSignal) { if (signal.aborted) throw new DOMException("Stopped", "AbortError"); }

export async function generateReport(id: string, phase: (s: string) => void, signal: AbortSignal): Promise<string> {
  phase("Generating exploratory report");
  const task = await engineCall("/api/report/generate", { simulation_id: id, force_regenerate: false });
  if (task.task_id) await waitTask(task.task_id, phase, signal);
  checkAbort(signal);
  const report = await engineCall("/api/report/by-simulation/" + encodeURIComponent(id));
  if (typeof report.markdown_content !== "string" || !report.markdown_content.trim()) throw new Error("Report content is unavailable");
  return report.markdown_content;
}
