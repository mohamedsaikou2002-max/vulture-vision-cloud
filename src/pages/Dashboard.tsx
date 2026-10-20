import { useEffect, useRef, useState } from "react";
import { functionError } from "@/lib/functionError";
import VVLayout from "@/components/VVLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchLatestBrief, fetchRegime, subscribeToIntelBriefs,
  IntelBrief, RegimeState, REGIME_COLORS, REGIME_LABELS, timeAgoShort, confidenceLabel,
} from "@/lib/intelApi";

interface Msg { type: "ai" | "user"; text: string; contextEligible?: boolean; }

const initialMsg: Msg = {
  type: "ai",
  text:
    "Vulture Vision intelligence research. Live evidence, explicit assumptions, and no guaranteed forecasts.",
};

export default function Dashboard() {
  const [messages, setMessages] = useState<Msg[]>([initialMsg]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState("STANDBY");
  const [brief, setBrief] = useState<IntelBrief | null>(null);
  const [regimeError,setRegimeError]=useState("Loading Nasdaq regime…");
  const [regime, setRegime] = useState<RegimeState | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, busy]);

  useEffect(() => {
    let alive = true;
    fetchLatestBrief().then(b => alive && b && setBrief(b));
    fetchRegime().then(r => {if(alive){setRegime(r);setRegimeError(r?"":"Market regime provider unavailable");}}).catch(e=>{if(alive){setRegime(null);setRegimeError(e instanceof Error?e.message:"Market regime unavailable");}});
    const bId = setInterval(() => fetchLatestBrief().then(b => alive && b && setBrief(b)), 15 * 60 * 1000);
    const rId = setInterval(() => fetchRegime().then(r => {if(alive){setRegime(r);setRegimeError(r?"":"Market regime provider unavailable");}}).catch(e=>{if(alive){setRegime(null);setRegimeError(e instanceof Error?e.message:"Market regime unavailable");}}), 2 * 60 * 1000);
    const unsub = subscribeToIntelBriefs(
      b => { if (alive) setBrief(b); },
      r => { if (alive) setRegime(r); },
    );
    return () => { alive = false; clearInterval(bId); clearInterval(rId); unsub(); };
  }, []);

  async function send() {
    const val = input.trim();
    if (!val || busy) return;
    setMessages(m => [...m, { type: "user", text: val, contextEligible: true }]);
    setInput("");
    setBusy(true);
    setMode("PROCESSING");
    try {
      const { data, error } = await supabase.functions.invoke("vv-chat", {
        signal: AbortSignal.timeout(55000),
        body: {
          message: val,
          intel_context: brief?.thesis || null,
          regime: regime?.current_state || null,
          history: messages.filter(m => m.contextEligible).slice(-6).map(m => ({ role: m.type === "ai" ? "model" : "user", text: m.text.slice(0, 2000) })),
        },
      });
      if (error) throw new Error(await functionError(error, "AI response unavailable. Try again shortly."));
      if (data?.error) throw new Error(data.error);
      const reply = data?.reply || data?.message || "[no reply]";
      setMessages(m => [...m, { type: "ai", text: String(reply), contextEligible: true }]);
    } catch (e: unknown) {
      setMessages(m => [...m, { type: "ai", text: `[ERROR: ${e instanceof Error ? e.message : "Backend Connection Failed"}]` }]);
    } finally {
      setBusy(false);
      setMode("STANDBY");
    }
  }

  const regimeColor = regime ? REGIME_COLORS[regime.current_state] : "var(--dim)";
  const regimeLabel = regime ? REGIME_LABELS[regime.current_state] : "—";
  const nextProbs = regime
    ? Object.entries(regime.transition_probs_next_session).sort((a, b) => b[1] - a[1]).slice(0, 3)
    : [];

  return (
    <VVLayout><div className="intel-workspace">
      {/* Morning Brief Strip */}
      <div className="morning-brief-strip">
        <span className="morning-brief-label">// MORNING BRIEF</span>
        {brief ? (
          <>
            <span className="morning-brief-text">{brief.morning_brief_headline}</span>
            <span className={`badge ${brief.overall_confidence >= 80 ? "badge-green" : brief.overall_confidence >= 60 ? "badge-gold" : "badge-dim"}`}>
              {confidenceLabel(brief.overall_confidence)} {brief.overall_confidence}%
            </span>
            <span className={`badge ${brief.cycle_type === "urgent_journalist" ? "badge-red" : "badge-dark"}`}>
              {brief.cycle_type === "urgent_journalist" ? "URGENT" : "SCHEDULED"}
            </span>
            <span className="morning-brief-label">{timeAgoShort(brief.generated_at)}</span>
          </>
        ) : (
          <span className="morning-brief-text awaiting">AWAITING SYNTHESIS...</span>
        )}
      </div>

      {/* Markov Regime Bar */}
      <div className="regime-bar">
        {regime ? (
          <>
            <span className="status-dot" style={{ background: regimeColor, boxShadow: `0 0 8px ${regimeColor}` }} />
            <span className="regime-state-label" style={{ color: regimeColor }}>{regimeLabel}</span>
            <span title={regime.method} style={{ color: "var(--dim)" }}>{regime.model_version || "External regime model"} · {regime.freshness || "freshness unverified"}</span>
            {nextProbs.map(([state, prob]) => (
              <span key={state} className="regime-prob-pill" style={{ color: REGIME_COLORS[state] || "var(--dim)" }}>
                → {REGIME_LABELS[state] || state}: {(prob * 100).toFixed(0)}%
              </span>
            ))}
            <span style={{ marginLeft: "auto", color: "var(--gold-dim)" }}>
              BASED ON {regime.observations_count} OBSERVATIONS · {regime.source} · {regime.last_verified_at}
            </span>
          </>
        ) : (
          <span style={{ color: "var(--dim)" }}>{regimeError}</span>
        )}
      </div>

      <div className="chat-wrap">
        <div className="chat-box panel">
          <div className="chat-header">
            <div className="status-dot" />
            <span className="chat-header-title">EAGLE EYE // INTELLIGENCE INTERFACE</span>
            <span className="chat-mode">{mode}</span>
          </div>

          <div className="chat-messages" ref={scrollRef} role="log" aria-label="Intelligence conversation" aria-live="polite">
            {messages.map((m, i) => (
              <div key={i} className={`msg msg-${m.type}`}>
                <div className="msg-label">{m.type === "ai" ? "// EAGLE EYE AI" : "// YOU"}</div>
                {m.text}
              </div>
            ))}
            {busy && (
              <div className="msg msg-ai">
                <div className="msg-label">// EAGLE EYE AI</div>
                <div className="typing"><span /><span /><span /></div>
              </div>
            )}
          </div>

          <div className="chat-input-row">
            <input
              className="chat-input"
              aria-label="Intelligence question"
              maxLength={8000}
              placeholder="Enter query..."
              value={input}
              disabled={busy}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) send(); }}
              autoComplete="off"
            />
            <button className="chat-send" onClick={send} disabled={busy || !input.trim()}>SEND</button>
          </div>
        </div>
      </div>
    </div></VVLayout>
  );
}
