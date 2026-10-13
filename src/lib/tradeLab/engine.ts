// Educational linear-contract arithmetic. No LLM probabilities or exchange margin assumptions.
export const ENGINE_VERSION='trade-lab-1';
export type Direction='long'|'short'|'neutral';
export interface TradePlan {
 symbol:string;direction:Direction;horizon:'scalp'|'intraday'|'swing';confidence:number;
 entry:number;stop:number;target:number;quantity:number;pointValue:number;
 equity:number;maxLoss:number;dailyLossLimit:number;leverage:number;
 orderType:'market'|'limit';feePerUnit:number;spreadBps:number;slippageBps:number;
 rationale:string;invalidation:string;session:string;catalysts:string;
}
export interface Candle {timestamp:string;open:number;high:number;low:number;close:number;volume:number;}
export interface ReplayResult {status:'not_filled'|'open'|'closed'|'no_trade';exitReason:string;entry:number|null;exit:number|null;netPnl:number;cost:number;mae:number;limitBreached:boolean;ambiguousBars:number;}
export const DEFAULT_PLAN:TradePlan={symbol:'BTC',direction:'long',horizon:'intraday',confidence:65,entry:100,stop:98,target:104,quantity:1,pointValue:1,equity:10000,maxLoss:100,dailyLossLimit:200,leverage:1,orderType:'market',feePerUnit:0,spreadBps:5,slippageBps:5,rationale:'',invalidation:'',session:'',catalysts:''};
export function validatePlan(p:TradePlan):TradePlan {
 if(!p || !/^[A-Z0-9/_-]{2,24}$/.test(p.symbol))throw new Error('Invalid instrument');
 if(!['long','short','neutral'].includes(p.direction) || !['scalp','intraday','swing'].includes(p.horizon) || !['market','limit'].includes(p.orderType))throw new Error('Invalid direction, horizon or order type');
 for(const name of ['entry','stop','target','quantity','pointValue','equity','maxLoss','dailyLossLimit','leverage'] as const)if(!Number.isFinite(p[name]) || p[name]<=0 || p[name]>1e12)throw new Error('Invalid '+name);
 for(const name of ['feePerUnit','spreadBps','slippageBps','confidence'] as const)if(!Number.isFinite(p[name]) || p[name]<0 || p[name]>(name==='confidence'?100:name==='feePerUnit'?1e6:1000))throw new Error('Invalid '+name);
 if(p.maxLoss>p.equity || p.dailyLossLimit>p.equity)throw new Error('Risk limits cannot exceed equity');
 if(p.direction==='long' && !(p.stop<p.entry && p.target>p.entry))throw new Error('Long: stop < entry < target');
 if(p.direction==='short' && !(p.target<p.entry && p.stop>p.entry))throw new Error('Short: target < entry < stop');
 for(const name of ['rationale','invalidation','session','catalysts'] as const)if(typeof p[name]!=='string' || p[name].length>2000)throw new Error('Invalid '+name);
 return {...p};
}
export function plannedRisk(p:TradePlan) {
 validatePlan(p);const notional=p.direction==='neutral'?0:p.entry*p.quantity*p.pointValue;
 const cost=p.direction==='neutral'?0:2*p.feePerUnit*p.quantity + notional*(p.spreadBps+2*p.slippageBps)/10000;
 const grossLoss=Math.abs(p.entry-p.stop)*p.quantity*p.pointValue;
 const loss=p.direction==='neutral'?0:grossLoss+cost;
 return {notional,cost,loss,riskPct:loss/p.equity*100,exposureLeverage:notional/p.equity,withinLimits:loss<=p.maxLoss && loss<=p.dailyLossLimit && notional<=p.equity*p.leverage};
}
export function expectancy(winRate:number,winR:number,lossR:number,costR:number) {
 if(![winRate,winR,lossR,costR].every(Number.isFinite) || winRate<0 || winRate>1 || winR<=0 || lossR<=0 || costR<0)throw new Error('Invalid expectancy inputs');
 return {expectedR:winRate*winR-(1-winRate)*lossR-costR,breakEven:(lossR+costR)/(winR+lossR)};
}
export function validateCandles(rows:Candle[],minimum=2):Candle[] {
 if(!Array.isArray(rows) || rows.length<minimum || rows.length>5000)throw new Error('Supply 2–5000 chronological candles');
 let last=-Infinity;
 return rows.map(c=>{
  const time=Date.parse(c.timestamp);
  if(!Number.isFinite(time) || !/(Z|[+-]\d{2}:\d{2})$/.test(c.timestamp) || time<=last)throw new Error('Timestamps must include timezone and increase strictly');
  last=time;
  if(![c.open,c.high,c.low,c.close,c.volume].every(Number.isFinite) || Math.min(c.open,c.high,c.low,c.close)<=0 || c.volume<0 || Math.max(c.open,c.high,c.low,c.close)>1e12 || c.low>Math.min(c.open,c.close) || c.high<Math.max(c.open,c.close) || c.low>c.high)throw new Error('Invalid OHLCV candle');
  return {...c};
 });
}
export function parseCandleCsv(text:string):Candle[] {
 if(text.length>1500000)throw new Error('CSV exceeds 1.5 MB');
 const lines=text.trim().split(/\r?\n/);
 if(lines[0]?.trim().toLowerCase()!=='timestamp,open,high,low,close,volume')throw new Error('Required header: timestamp,open,high,low,close,volume');
 return validateCandles(lines.slice(1).map(line=>{const v=line.split(',').map(x=>x.trim());if(v.length!==6 || v.slice(1).some(x=>!x))throw new Error('Invalid CSV row');return {timestamp:v[0],open:Number(v[1]),high:Number(v[2]),low:Number(v[3]),close:Number(v[4]),volume:Number(v[5])};}));
}
// Only bars after the committed decision are passed here. OHLC cannot identify intrabar event order.
export function evaluateReplay(plan:TradePlan,bars:Candle[]):ReplayResult {
 const p=validatePlan(plan);
 const result:ReplayResult={status:p.direction==='neutral'?'no_trade':'not_filled',exitReason:p.direction==='neutral'?'Abstain':'Entry not reached',entry:null,exit:null,netPnl:0,cost:0,mae:0,limitBreached:false,ambiguousBars:0};
 if(p.direction==='neutral' || !bars.length)return result;
 validateCandles(bars,1);
 let entryExecutionCost=0;
 const sign=p.direction==='long'?1:-1;
 const adverse=(price:number,side:number)=>price*(1+side*(p.spreadBps/2+p.slippageBps)/10000);
 for(const c of bars){
  let uncertainEntry=false;
  if(result.entry===null){
   let fill:number|null=null;
   if(p.orderType==='market')fill=c.open;
   else if(sign===1 && c.low<=p.entry)fill=Math.min(c.open,p.entry);
   else if(sign===-1 && c.high>=p.entry)fill=Math.max(c.open,p.entry);
   if(fill===null)continue;
   uncertainEntry=p.orderType==='limit' && (sign===1?c.open>p.entry:c.open<p.entry);
   // Limit entry never fills worse than the requested limit; fees still apply.
   result.entry=p.orderType==='limit'?fill:adverse(fill,sign);entryExecutionCost=Math.abs(result.entry-fill)*p.quantity*p.pointValue;result.status='open';
  }
  const entry=result.entry;const worst=sign===1?c.low:c.high;
  result.mae=Math.max(result.mae,Math.max(0,(entry-worst)*sign*p.quantity*p.pointValue));
  const stopHit=sign===1?c.low<=p.stop:c.high>=p.stop;
  const touchedTarget=sign===1?c.high>=p.target:c.low<=p.target;
  const targetHit=touchedTarget && !uncertainEntry;
  if(touchedTarget && uncertainEntry)result.ambiguousBars++;
  if(stopHit && targetHit)result.ambiguousBars++;
  let exit:number|null=null;let exitExecutionCost=0;
  if(stopHit){const rawExit=sign===1?Math.min(c.open,p.stop):Math.max(c.open,p.stop);exit=adverse(rawExit,-sign);exitExecutionCost=Math.abs(exit-rawExit)*p.quantity*p.pointValue;result.exitReason=stopHit&&targetHit?'Stop first: ambiguous OHLC bar':'Stop / gap through stop';}
  else if(targetHit){exit=p.target;result.exitReason='Target limit assumed filled';}
  else {exit=adverse(c.close,-sign);exitExecutionCost=Math.abs(exit-c.close)*p.quantity*p.pointValue;result.exitReason=uncertainEntry && touchedTarget?'Target may precede intrabar limit entry; position remains open':'Marked to market; position still open';}
  result.exit=exit;
  const fees=2*p.feePerUnit*p.quantity;
  result.cost=fees+entryExecutionCost+exitExecutionCost;
  result.netPnl=(exit-entry)*sign*p.quantity*p.pointValue-fees;
  result.limitBreached=result.limitBreached || -result.netPnl>p.maxLoss || -result.netPnl>p.dailyLossLimit;
  if(stopHit || targetHit){result.status='closed';break;}
 }
 return result;
}
export interface StressResult {name:string;assumption:string;pnl:number|null;kind:'synthetic'|'requires_data';breached:boolean;}
export function stressSuite(p:TradePlan):StressResult[] {
 validatePlan(p);const sign=p.direction==='short'?-1:1;const risk=plannedRisk(p);const loss=risk.loss;
 if(p.direction==='neutral')return [{name:'No trade',assumption:'No position or trading costs',pnl:0,kind:'synthetic',breached:false}];
 const adversePnl=(distance:number,costFactor=1)=>-distance*p.quantity*p.pointValue-risk.cost*costFactor;
 const row=(name:string,assumption:string,pnl:number|null):StressResult=>({name,assumption,pnl,kind:pnl===null?'requires_data':'synthetic',breached:pnl!==null && -pnl>Math.min(p.maxLoss,p.dailyLossLimit)});
 return [
  row('Directional reversal','Exit at planned stop; estimated costs',-loss),
  row('False breakout','One stopped attempt; no automatic re-entry',-loss),
  row('Volatility shock','Adverse distance doubles; assumes stop execution failure',adversePnl(2*Math.abs(p.entry-p.stop))),
  row('Liquidity collapse','Stop distance unchanged; assumed execution costs triple',adversePnl(Math.abs(p.entry-p.stop),3)),
  row('News gap','Adverse gap of 3% of entry; illustrative, not a measured probability',adversePnl(Math.max(Math.abs(p.entry-p.stop),p.entry*.03))),
  row('Execution failure','Stop rejected; adverse move of 5% of entry',adversePnl(Math.max(Math.abs(p.entry-p.stop),p.entry*.05))),
  ...[5,10,15].map(n=>row(n+' consecutive losses','Fixed quantity and costs; no recovery assumption',-n*loss)),
  row('Correlation breakdown','Requires portfolio positions and joint return histories',null),
  row('Regime shift','Requires labeled independent market periods',null),
  row('Overfitting / unseen-data degradation','Requires frozen strategy rules and a held-out evaluation dataset',null),
  row('Correct direction, poor execution','Favorable move to target minus estimated execution costs',(p.target-p.entry)*sign*p.quantity*p.pointValue-risk.cost),
 ];
}
export function summarizeJournal(results:ReplayResult[],equity:number) {
 const closed=results.filter(r=>r.status==='closed');
 const wins=closed.filter(r=>r.netPnl>0),losses=closed.filter(r=>r.netPnl<0);
 const grossWin=wins.reduce((s,r)=>s+r.netPnl,0),grossLoss=-losses.reduce((s,r)=>s+r.netPnl,0);
 let balance=equity,peak=equity,maxDrawdown=0;
 for(const r of closed){balance+=r.netPnl;peak=Math.max(peak,balance);maxDrawdown=Math.max(maxDrawdown,peak-balance);}
 return {trades:closed.length,winRate:closed.length?wins.length/closed.length:null,expectancy:closed.length?(grossWin-grossLoss)/closed.length:null,profitFactor:grossLoss?grossWin/grossLoss:null,maxDrawdown,breaches:closed.filter(r=>r.limitBreached).length};
}
