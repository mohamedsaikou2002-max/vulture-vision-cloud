/** Transparent retrospective rule; no calibrated transition probabilities. */
export function classifyRegime(closes:number[],dates:string[],now=Date.now()){
 const last=dates.at(-1),age=last?now-Date.parse(last):Infinity;
 const base={source:'Yahoo Finance Nasdaq Composite (^IXIC)',last_verified_at:last||null,observations_count:closes.length,model_version:'nasdaq-trend-vol-v1',method:'20-session price change and annualized daily log-return volatility; thresholds ±3% and 35%. Descriptive, uncalibrated heuristic.',transition_probs_next_session:{},transition_probs_n_sessions:{},stationary_distribution:{},n_sessions:0,most_likely_next:'unavailable',current_duration_sessions:0};
 if(closes.length<35||closes.some(n=>!Number.isFinite(n)||n<=0))return {...base,status:'insufficient_observations',freshness:'unavailable',current_state:null,regime_summary:'At least 35 valid Nasdaq daily closes are required.'};
 if(!Number.isFinite(age)||age< -60000||age>5*86400000)return {...base,status:'stale',freshness:'stale',current_state:null,regime_summary:'Nasdaq history is stale or undated; no current regime was calculated.'};
 const recent=closes.slice(-21),returns=recent.slice(1).map((n,i)=>Math.log(n/recent[i]));const mean=returns.reduce((a,b)=>a+b,0)/returns.length;
 const vol=Math.sqrt(returns.reduce((s,n)=>s+(n-mean)**2,0)/returns.length*252);const change=recent.at(-1)!/recent[0]-1;
 const current_state=vol>.35?'volatile':change>.03?'risk_on':change<-.03?'risk_off':'neutral';
 return {...base,status:'available',freshness:'available',current_state,regime_summary:`Nasdaq descriptive regime: ${current_state}. 20-session change ${(change*100).toFixed(1)}%; realized volatility ${(vol*100).toFixed(1)}%. No predictive transition model is connected.`};
}
