import {useMemo,useState} from "react";
import {LineChart,Line,XAxis,YAxis,Legend,Tooltip,ResponsiveContainer} from "recharts";
import {DEFAULT_SCENARIO,PRESET_SCENARIOS,simulateScenario,type ScenarioInputs} from "@/lib/localSocioScenario";

const controls=[
  {key:"credit",name:"Credit tightening",min:0,max:100},
  {key:"supply",name:"Supply disruption",min:0,max:100},
  {key:"demand",name:"Demand change",min:-100,max:100},
  {key:"policy",name:"Policy support",min:0,max:100},
] as const;

export default function LocalSocioLab(){
  const [input,setInput]=useState<ScenarioInputs>({...DEFAULT_SCENARIO});
  const simulated=useMemo(()=>simulateScenario(input),[input]);
  const baseline=useMemo(()=>simulateScenario({credit:0,supply:0,demand:0,policy:0,periods:input.periods}),[input.periods]);
  const plot=simulated.map((point,i)=>({...point,baselineLiquidity:baseline[i].liquidity}));
  const final=simulated[simulated.length-1];
  const summary=[
    {label:"Lowest liquidity",value:Math.min(...simulated.map(p=>p.liquidity)),base:0.64},
    {label:"Peak default stress",value:Math.max(...simulated.map(p=>p.defaultRisk)),base:0.30},
    {label:"End-period growth",value:final.growth,base:0.60},
    {label:"End-period trust",value:final.trust,base:0.64},
  ];
  const update=(key:keyof ScenarioInputs,value:number)=>setInput(old=>({...old,[key]:value}));
  return <section className="panel" aria-label="Local socio-economic simulator"
      style={{margin:"14px 24px 16px",padding:16}}>
    <div className="panel-title">SOCIO-ECONOMIC SCENARIO LAB · LOCAL ENGINE ACTIVE</div>
    <p role="status" style={{color:"var(--green-bright)",fontSize:11,margin:"10px 0"}}>LOCAL MODEL READY · NO API KEY REQUIRED</p>
    <p style={{fontSize:11,lineHeight:1.7,color:"var(--text)"}}>
      Modify hypothetical credit, supply, demand and policy shocks. The numerical indices are synthetic,
      uncalibrated and bounded between 0 and 1. This is a deterministic educational stress model,
      not a live market forecast, trading signal, probability estimate or historical backtest.
      The separately hosted MiroFish multi-agent service requires authorized backend access.
    </p>
    <div style={{display:"flex",gap:8,flexWrap:"wrap",margin:"16px 0"}}>
      {Object.entries(PRESET_SCENARIOS).map(([name,value])=><button key={name} className="sim-btn" type="button"
        onClick={()=>setInput({...value})}>{name}</button>)}
      <button className="sim-btn" type="button" onClick={()=>setInput({...DEFAULT_SCENARIO})}>Reset</button>
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      {controls.map(({key,name,min,max})=><label key={key} className="block" style={{fontSize:11,color:"var(--gold)"}}>
        {name} <strong>{input[key]}</strong>
        <input aria-label={name} type="range" min={min} max={max} step="5" value={input[key]}
          className="w-full" style={{accentColor:"var(--gold)",marginTop:7}}
          onChange={e=>update(key,Number(e.target.value))}/>
      </label>)}
    </div>
    <label style={{fontSize:11,color:"var(--gold)",display:"block",marginTop:14,maxWidth:350}}>
      Hypothetical steps {input.periods}
      <input aria-label="Hypothetical steps" className="w-full" type="range" min={1} max={24} step={1}
        value={input.periods} style={{accentColor:"var(--gold)",marginTop:7}}
        onChange={e=>update("periods",Number(e.target.value))}/>
    </label>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" style={{marginTop:16}}>
      {summary.map(m=><div key={m.label} className="panel" style={{padding:12,margin:0}}>
        <div style={{fontSize:10,color:"var(--dim)"}}>{m.label}</div>
        <div style={{fontSize:19,color:"var(--gold-bright)",marginTop:7}}>{m.value.toFixed(3)}</div>
        <div style={{fontSize:10,color:"var(--dim)"}}>No-shock baseline {m.base.toFixed(3)}</div>
      </div>)}
    </div>
    <div style={{height:280,width:"100%",marginTop:18}}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={plot}>
          <XAxis dataKey="period" tick={{fill:"#8a7a55",fontSize:10}}/>
          <YAxis domain={[0,1]} tick={{fill:"#8a7a55",fontSize:10}}/>
          <Tooltip contentStyle={{background:"#080808",border:"1px solid #c9a84c"}}/>
          <Legend wrapperStyle={{fontSize:10}}/>
          <Line isAnimationActive={false} dataKey="liquidity" stroke="#00e5ff" dot={false} name="Scenario liquidity"/>
          <Line isAnimationActive={false} dataKey="defaultRisk" stroke="#ff9d4d" dot={false} name="Scenario default stress"/>
          <Line isAnimationActive={false} dataKey="baselineLiquidity" stroke="#999999" strokeDasharray="4 4" dot={false} name="No-shock liquidity"/>
        </LineChart>
      </ResponsiveContainer>
    </div>
    <p style={{fontSize:10,color:"var(--dim)",marginTop:8}}>
      Local engine v1. Steps are hypothetical periods, not dates. Results are for scenario exploration only.
    </p>
  </section>;
}
