import { AGENTS, ENGINE_VERSION, neutralVector, runDimensionScenario, marketConditions, autoConfigure, scenarioMonteCarlo } from '../../../supabase/functions/_shared/autosim_engine';
import type { AutoSimResult } from '../../../supabase/functions/_shared/autosim_types';
export function simulationFixture(): AutoSimResult {
  const baseline=neutralVector(), horizon=3, seed=123;
  const dims=runDimensionScenario({baseline,shocks:{fear:.05},horizonDays:horizon,paths:3,seed});
  const conditions=marketConditions(baseline,dims,.03,horizon);
  const execution=autoConfigure(baseline,baseline,'balanced');
  const scenario=scenarioMonteCarlo({warmupCloses:Array(60).fill(100),mc:conditions,horizon,paths:3,seed,cost:execution.cost,bias:0});
  return {
    engine_version:ENGINE_VERSION,model:'fixture',as_of:new Date().toISOString(),scenario:'A liquidity crunch affects funding',seed,horizon_days:horizon,mode:'hypothetical',
    interpretation:{event_type:'liquidity_crunch',summary:'Hypothetical funding stress',is_hypothetical:true,asset:'BTC-USD',regions:[],sectors:[],shock_rationale:{},risk_profile:'balanced',confidence:.3},
    evidence:{status:'none_found',window_hours:72,sources_reporting:0,matched:0,independent_sources:0,selected:[]},
    state:{baseline,detail:Object.fromEntries(Object.entries(baseline).map(([d,value])=>[d,{value,source:'neutral_default'}])) as AutoSimResult['state']['detail'],neutral_dimensions:Object.keys(baseline) as (keyof typeof baseline)[],data_status:[]},
    shocks:{applied:{fear:.05},injected:{}},dimensions:{distribution:dims.distribution,trajectory:dims.trajectory},agents:dims.agent_response_mean,
    market:{asset:'BTC-USD',price_source:'synthetic_start_100',base_daily_vol:.03,risk_off_shift:conditions.riskOffShift,direction_bias:0},execution,
    strategies:{scenario:scenario.strategies,buy_hold_scenario:scenario.buy_hold,historical:null},analysis:{headline:'Fixture scenario',summary:'Numerical test output'},warnings:[],calibration_status:'uncalibrated',disclaimer:'Research fixture only',
  };
}
