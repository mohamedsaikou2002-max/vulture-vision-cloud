import { useState } from "react";
import { Link } from "react-router-dom";
import VVLayout from "@/components/VVLayout";

type DemoMode = "intel" | "simulation";

const scenarios = [
  {
    id: "rates",
    name: "Surprise rate increase",
    premise: "A central bank unexpectedly raises rates by 50 basis points.",
    finding: "Illustrative assessment: Short-duration financing becomes more expensive. Rate-sensitive growth assets can face valuation pressure, while cash and floating-rate borrowing respond differently. Watch real yields, credit spreads, and sector dispersion.",
    risk: "Contrary case: If inflation expectations fall faster than policy rates rise, some duration-sensitive assets could stabilize.",
    action: "Monitor Treasury yields and the next inflation release; compare exposure under both cases.",
  },
  {
    id: "chips",
    name: "Semiconductor supply restriction",
    premise: "A hypothetical new export restriction affects advanced semiconductor supply chains.",
    finding: "Illustrative assessment: Supply-constrained chip inputs may raise costs and lengthen lead times. Impacts differ between foundries, equipment suppliers, hyperscalers, and downstream manufacturers.",
    risk: "Contrary case: Inventory buffers, geographic substitution, and exemptions could reduce near-term effects.",
    action: "Review announced policy text, company exposure, inventories, and trading-volume concentration.",
  },
  {
    id: "crypto",
    name: "Crypto liquidity disruption",
    premise: "A large digital-asset trading venue temporarily suspends withdrawals.",
    finding: "Illustrative assessment: Liquidity fragmentation and counterparty uncertainty can widen spreads, raise volatility, and change stablecoin flows. This is a scenario, not a forecast.",
    risk: "Contrary case: Alternate venues or rapid resolution could restore liquidity without a prolonged repricing.",
    action: "Check exchange status, observable order-book depth, on-chain flows, and exchange-specific exposure.",
  },
] as const;

export default function InvestorDemo({ mode }: { mode: DemoMode }) {
  const [selected, setSelected] = useState<string>(scenarios[0].id);
  const [question, setQuestion] = useState("How would a surprise rate increase affect technology equities?");
  const [show, setShow] = useState(false);
  const scenario = scenarios.find(s => s.id === selected) ?? scenarios[0];
  const intel = mode === "intel";
  function choose(id: string) {
    setSelected(id);
    setShow(false);
    const picked = scenarios.find(s => s.id === id);
    if (picked) setQuestion("Analyze the risk and alternative explanations for: " + picked.premise);
  }
  return (
    <VVLayout status={{ label:"PRELOADED DEMO", tone:"gold" }}>
      <section className="vv-demo" aria-label={intel ? "Investor intelligence demonstration" : "Investor simulation demonstration"}>
        <span className="demo-kicker">Vulture Vision Cloud · Investor presentation</span>
        <h1>{intel ? "AI Intelligence • Guided Demo" : "Scenario Lab • Guided Demo"}</h1>
        <p>
          This presentation uses <strong>preloaded example analysis</strong>, not live AI generation,
          calibrated predictions, or a completed backtest. The News and Analytics tabs remain
          connected to their respective hosted data services and report availability separately.
        </p>
        <div className="vv-demo-grid">
          <div className="vv-demo-card">
            <h2>01 / Choose a scenario</h2>
            <label htmlFor="vv-demo-scenario">Demonstration case</label>
            <select id="vv-demo-scenario" value={selected} onChange={e => choose(e.target.value)}>
              {scenarios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <span className="vv-demo-chip">Synthetic research case</span>
            <p>{scenario.premise}</p>
            {intel && <>
              <h2 style={{ marginTop:20 }}>02 / Research prompt</h2>
              <label htmlFor="vv-demo-question">Preconfigured question</label>
              <select id="vv-demo-question" value={question} onChange={e => setQuestion(e.target.value)}>
                <option value={question}>{question}</option>
                <option value="What evidence would invalidate this scenario?">What evidence would invalidate this scenario?</option>
                <option value="Which market indicators should be monitored?">Which market indicators should be monitored?</option>
              </select>
            </>}
            <button style={{ marginTop:20 }} onClick={() => setShow(true)}>
              {intel ? "Show recorded intelligence brief" : "Run example scenario"}
            </button>
          </div>
          <div className="vv-demo-card">
            <h2>{intel ? "03 / Analyst panel" : "02 / Scenario output"}</h2>
            {show ? <>
              <span className="vv-demo-chip">PRELOADED · NOT LIVE INFERENCE</span>
              <div className="vv-demo-output" role="status">
                <strong>Primary interpretation</strong>
                <p>{scenario.finding}</p>
                <strong>Adversarial viewpoint</strong>
                <p>{scenario.risk}</p>
                <strong>Evidence to monitor</strong>
                <p>{scenario.action}</p>
              </div>
            </> : <p>Select a demonstration case, then reveal the recorded response. No paid inference or hosted simulation job will be initiated.</p>}
          </div>
        </div>
        <div className="vv-demo-actions">
          <Link to="/news">Open live news feed</Link>
          <Link to="/analytics">Open live market analytics</Link>
          <Link to={intel ? "/simulations" : "/dashboard"}>{intel ? "Scenario demo" : "Intelligence demo"}</Link>
        </div>
      </section>
    </VVLayout>
  );
}
