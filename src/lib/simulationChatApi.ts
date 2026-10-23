import { supabase } from "@/integrations/supabase/client";
import { withRequestDeadline } from './requestDeadline';
import type {
  SimulationChatRequest, SimulationChatAnswer
} from "../../supabase/functions/_shared/simulation_chat_contract";

export async function askSimulationResearch(request: SimulationChatRequest): Promise<SimulationChatAnswer> {
 return withRequestDeadline(async signal => {
  const { data, error } = await supabase.functions.invoke("vv-simulation-chat", { body: request, signal });
  if (error) {
    let explanation = error.message || "Simulation chat service is unavailable";
    const context = (error as typeof error & { context?: Response }).context;
    if (context && typeof context.json === "function") {
      try {
        const body = await context.json();
        if (typeof body?.error === "string") explanation = body.error;
      } catch { /* Retain original error. */ }
    }
    throw new Error(explanation);
  }
  if (data?.error) throw new Error(data.error);
  if (!data || data.kind !== "model_synthesis" || typeof data.answer !== "string" || !Array.isArray(data.specialists)) {
    throw new Error("Gemini did not return a valid simulation response");
  }
  return data as SimulationChatAnswer;
 },55000);
}
