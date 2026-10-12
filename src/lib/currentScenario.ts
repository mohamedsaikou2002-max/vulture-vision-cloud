import { supabase } from '@/integrations/supabase/client';
export { buildCurrentSeed, buildEvaluationRequirement } from '../../supabase/functions/_shared/scenario_contract';
export type { CapitalInputs, ScenarioBrief } from '../../supabase/functions/_shared/scenario_contract';
import type { CapitalInputs, ScenarioBrief } from '../../supabase/functions/_shared/scenario_contract';
export const DEFAULT_CAPITAL_INPUTS: CapitalInputs = {
  objective: 'Compare how current global events could affect my options while preserving liquidity.',
  capital: null, currency: 'USD', horizon_days: 30, risk_tolerance: 'medium', exposures: '', constraints: '', alternatives: '',
};
export async function requestCurrentBrief(inputs: CapitalInputs, article_ids: string[] = []): Promise<ScenarioBrief> {
  const { data, error } = await supabase.functions.invoke('vv-scenario-brief', { body: { inputs, article_ids } });
  if (error || data?.error) {
    let message = data?.error || error?.message || 'Synthesis unavailable';
    const context = error?.context;
    if (context instanceof Response) { try { message = (await context.json()).error || message; } catch { /* Preserve transport error. */ } }
    throw new Error(message);
  }
  if (!data?.snapshot_id || !Array.isArray(data.news) || !Array.isArray(data.suggestions)) throw new Error('Invalid synthesis response');
  return data;
}
