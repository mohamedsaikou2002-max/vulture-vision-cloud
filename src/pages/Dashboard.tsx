import { useEffect, useRef, useState } from "react";
import VVLayout from "@/components/VVLayout";
import { supabase } from "@/integrations/supabase/client";

interface Msg { type: "ai" | "user"; text: string; }

const initialMsg: Msg = {
  type: "ai",
  text:
    "System online. All monitoring layers active. Query anything — dark web activity, market status, breach intelligence, or threat analysis.",
};

export default function Dashboard() {
  const [messages, setMessages] = useState<Msg[]>([initialMsg]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState("STANDBY");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, busy]);

  async function send() {
    const val = input.trim();
    if (!val || busy) return;
    setMessages(m => [...m, { type: "user", text: val }]);
    setInput("");
    setBusy(true);
    setMode("PROCESSING");
    try {
      const { data, error } = await supabase.functions.invoke("vv-chat", {
        body: { message: val },
      });
      if (error) throw error;
      const reply = data?.reply || data?.message || "[no reply]";
      setMessages(m => [...m, { type: "ai", text: String(reply) }]);
    } catch (e: any) {
      setMessages(m => [...m, { type: "ai", text: `[ERROR: ${e?.message || "Backend Connection Failed"}]` }]);
    } finally {
      setBusy(false);
      setMode("STANDBY");
    }
  }

  return (
    <VVLayout>
      <div className="chat-wrap">
        <div className="chat-box panel">
          <div className="chat-header">
            <div className="status-dot" />
            <span className="chat-header-title">EAGLE EYE // INTELLIGENCE INTERFACE</span>
            <span className="chat-mode">{mode}</span>
          </div>

          <div className="chat-messages" ref={scrollRef}>
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
              placeholder="Enter query..."
              value={input}
              disabled={busy}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") send(); }}
              autoComplete="off"
            />
            <button className="chat-send" onClick={send} disabled={busy}>SEND</button>
          </div>
        </div>
      </div>
    </VVLayout>
  );
}
