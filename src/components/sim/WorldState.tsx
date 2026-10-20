import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { DIMENSIONS } from "../../../supabase/functions/_shared/autosim_engine";
import { fetchWorldState } from "@/lib/autoSimApi";
import { label } from "./DimensionCanvas";

type WS = Awaited<ReturnType<typeof fetchWorldState>>;
export default function WorldState() {
  const [ws, setWs] = useState<WS | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { fetchWorldState().then(setWs).catch(e => setErr((e as Error).message)); }, []);
  if (err) return <p className="sim-note sim-warn">World state unavailable: {err}</p>;
  if (!ws) return <p className="sim-note">Reading live indicators…</p>;
  const live = DIMENSIONS.length - ws.neutral_dimensions.length;
  return (
    <div>
      <p className="sim-note">{live} of {DIMENSIONS.length} dimensions are driven by live data{ws.neutral_dimensions.length ? `; ${ws.neutral_dimensions.length} use a labelled neutral default` : ""}.</p>
      <div className="sim-dims">
        {DIMENSIONS.map(d => (
          <div key={d} className="sim-dim" title={`${ws.detail[d].source}${ws.detail[d].observed_at ? " · " + ws.detail[d].observed_at : ""}`}>
            <span>{label(d)}</span>
            <div className="sim-track"><div style={{ width: `${ws.baseline[d] * 100}%` }} className={ws.detail[d].source === "neutral_default" ? "sim-fill dim" : "sim-fill"} /></div>
            <b>{ws.baseline[d].toFixed(2)}</b>
          </div>
        ))}
      </div>
      <div className="sim-sources">
        {ws.data_status.map(s => <span key={s.id} className={s.ok ? "sim-chip ok" : "sim-chip bad"} title={s.detail}>{s.id.replace("fred:", "")}</span>)}
      </div>
    </div>
  );
}
