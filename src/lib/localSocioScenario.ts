/** Deterministic hypothetical socio-economic shock model. Values are uncalibrated 0..1 indices, not predictions. */
export interface ScenarioInputs {
  credit: number; supply: number; demand: number; policy: number; periods: number;
}
export interface ScenarioPoint {
  period: number; fear: number; trust: number; liquidity: number; volatility: number;
  creditAccess: number; inflation: number; employment: number; growth: number; defaultRisk: number;
}
export const DEFAULT_SCENARIO: ScenarioInputs = {credit: 65, supply: 20, demand: -35, policy: 25, periods: 12};
export const PRESET_SCENARIOS: Record<string,ScenarioInputs> = {
  "Credit crunch": {credit: 85,supply: 15,demand: -50,policy: 20,periods: 12},
  "Supply disruption": {credit: 15,supply: 90,demand: -20,policy: 15,periods: 12},
  "Demand recovery": {credit: 10,supply: 10,demand: 75,policy: 45,periods: 12},
  "Policy stabilization": {credit: 40,supply: 35,demand: -30,policy: 90,periods: 12},
};
const bounded=(n:number)=>Math.round(Math.max(0,Math.min(1,n))*1000)/1000;
const valid=(n:number,min:number,max:number)=>Number.isFinite(n)&&n>=min&&n<=max;
export function simulateScenario(input:ScenarioInputs):ScenarioPoint[] {
  if(!valid(input.credit,0,100)||!valid(input.supply,0,100)||
     !valid(input.demand,-100,100)||!valid(input.policy,0,100)||
     !Number.isInteger(input.periods)||!valid(input.periods,1,24)) throw new RangeError("Invalid scenario parameters");
  const points:ScenarioPoint[]=[];
  let priorDefault=0.3;
  for(let period=0;period<=input.periods;period++){
    const fade=period===0?0:Math.exp(-(period-1)/Math.max(3,input.periods/2));
    const c=input.credit/100*fade,s=input.supply/100*fade,d=input.demand/100*fade,p=input.policy/100*fade;
    const feedback=period===0?0:Math.max(0,priorDefault-0.3)*0.22;
    const point:ScenarioPoint={
      period,
      fear:bounded(0.30+0.25*c+0.13*s-0.12*d-0.16*p+feedback),
      trust:bounded(0.64-0.22*c-0.12*s+0.11*d+0.18*p-feedback),
      liquidity:bounded(0.64-0.42*c-0.10*s+0.12*d+0.24*p-feedback),
      volatility:bounded(0.28+0.29*c+0.25*s+0.13*Math.abs(d)-0.12*p+feedback),
      creditAccess:bounded(0.67-0.45*c-0.08*s+0.09*d+0.19*p-feedback),
      inflation:bounded(0.36+0.38*s+0.11*d-0.06*c),
      employment:bounded(0.66-0.15*c-0.11*s+0.28*d+0.07*p),
      growth:bounded(0.60-0.24*c-0.17*s+0.31*d+0.11*p-feedback),
      defaultRisk:bounded(0.30+0.31*c+0.09*s-0.16*d-0.20*p+feedback),
    };
    points.push(point);priorDefault=point.defaultRisk;
  }
  return points;
}
