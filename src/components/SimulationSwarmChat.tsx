import { useEffect, useRef, useState } from "react";
import { BrainCircuit, CircleAlert, CircleHelp, Send, Trash2, Zap } from "lucide-react";
import { askSimulationResearch } from "@/lib/simulationChatApi";
import {
  SPECIALISTS,
  type AnalystMode, type NewsItem, type SimulationChatAnswer, type ConversationTurn
} from "../../supabase/functions/_shared/simulation_chat_contract";

export interface SimulationRoomProps {
  scenario: string;
  contextSummary: string;
  asOf: string;
  news: NewsItem[];
  report: string;
  runStatus: string;
  round: number;
  contextKey: string;
}
interface Exchange {
  id: number;
  question: string;
  choice: AnalystMode;
  result: SimulationChatAnswer;
}
const specialists: Record<string, { label: string; description: string; accent: string }> = {
  bull: { label: "BULL", description: "Constructive thesis", accent: "text-emerald-400" },
  bear: { label: "BEAR", description: "Adversarial downside", accent: "text-rose-400" },
  macro: { label: "MACRO", description: "Policy and contagion", accent: "text-cyan-400" },
  risk: { label: "RISK", description: "Exposure and invalidation", accent: "text-amber-400" },
};
const prompts = [
  "Challenge this thesis with opposing evidence.",
  "What market signals would invalidate the scenario?",
  "Which liquidity and policy shocks should we stress-test?",
];
export default function SimulationSwarmChat(props: SimulationRoomProps) {
  const [choice, setChoice] = useState<AnalystMode>("panel");
  const [question, setQuestion] = useState("");
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [error, setError] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [responded, setResponded] = useState(false);
  const next = useRef(0);
  const generation = useRef(0);
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // News-version or historical-event changes invalidate the prior frozen input context.
    generation.current += 1;
    setExchanges([]);
    setResponded(false);
    setError("");
    setWaiting(false);
  }, [props.contextKey]);

  async function send() {
    const text = question.trim();
    if (!text || waiting || !props.scenario.trim()) return;
    const current = generation.current;
    setWaiting(true);
    setError("");
    const history: ConversationTurn[] = exchanges.slice(-4).flatMap(e => [
      { role: "user" as const, content: e.question.slice(0, 1200) },
      { role: "assistant" as const, content: e.result.answer.slice(0, 1200) },
    ]);
    try {
      const result = await askSimulationResearch({
        question: text.slice(0, 1500),
        scenario: props.scenario.slice(0, 4000),
        mode: choice,
        history,
        contextSummary: props.contextSummary.slice(0, 3000),
        asOf: props.asOf,
        news: props.news.slice(0, 8),
        report: props.report.slice(0, 12000),
        runStatus: props.runStatus,
        round: props.round,
      });
      if (generation.current !== current) return;
      setExchanges(previous => [...previous, { id: ++next.current, question: text, choice, result }]);
      setResponded(true);
      setQuestion("");
      if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => container.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" }));
    } catch (e) {
      if (generation.current === current) setError(e instanceof Error ? e.message : "Could not contact the AI research room");
    } finally {
      if (generation.current === current) setWaiting(false);
    }
  }
  const remoteAvailable = ["completed", "running", "stopped"].includes(props.runStatus);
  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-primary/35 bg-background/95" aria-label="Gemini simulation response room">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex items-center gap-3">
          <BrainCircuit className="h-6 w-6 text-primary" aria-hidden="true" />
          <div>
            <p className="text-xs uppercase tracking-[.2em] text-primary">Research response pod</p>
            <h2 className="text-xl font-semibold text-foreground">Simulation Swarm Chat</h2>
          </div>
        </div>
        <span role="status" className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
          {waiting ? "GEMINI GENERATING" : responded ? "GEMINI REPLIED" : "GEMINI STATUS UNVERIFIED"}
        </span>
      </header>
      <div className="grid lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-5 border-b border-border bg-primary/5 p-5 lg:border-b-0 lg:border-r" aria-label="Analyst selection">
          <div>
            <p className="text-xs font-medium uppercase tracking-[.16em] text-primary">Pod roster</p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Four synthetic analyst viewpoints, inspired by Belicia PodRoom. Gemini composes the dialogue; these are not separate live MiroFish agents.</p>
          </div>
          <button type="button" onClick={() => setChoice("panel")} disabled={waiting}
            aria-pressed={choice === "panel"}
            className={"w-full rounded-lg border px-3 py-3 text-left text-sm " + (choice === "panel" ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground")}>
            <Zap className="mr-2 inline h-4 w-4" aria-hidden="true" />FULL ANALYST PANEL
          </button>
          <div className="space-y-2">
            {SPECIALISTS.map(role => {
              const detail = specialists[role];
              return (
                <button key={role} type="button" disabled={waiting} aria-pressed={choice === role}
                  onClick={() => setChoice(role)}
                  className={"w-full rounded-lg border px-3 py-3 text-left " + (choice === role ? "border-primary bg-primary/10" : "border-border bg-background/70")}>
                  <span className={"text-xs font-semibold tracking-widest " + detail.accent}>{detail.label}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{detail.description}</span>
                </button>
              );
            })}
          </div>
          <div className="space-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
            <div>Context: {props.asOf ? "snapshot " + props.asOf : "scenario input only"}</div>
            <div>News items supplied: {props.news.length}</div>
            <div>Engine: {remoteAvailable ? props.runStatus + " · round " + props.round : "No completed MiroFish run attached"}</div>
            <div>Report attached: {props.report.trim() ? "yes" : "no"}</div>
          </div>
        </aside>
        <div className="min-w-0 space-y-5 p-5">
          <div className="flex items-start gap-2 rounded-lg border border-border bg-primary/5 p-3 text-xs text-muted-foreground">
            <CircleHelp className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Ask about hypotheses, agent responses, market shocks and risk. The room works independently of the remote MiroFish engine when Gemini and authentication are configured. Model dialogue is synthetic, not a measured market forecast.</span>
          </div>
          <div ref={container} aria-live="polite" className="max-h-[740px] min-h-32 space-y-5 overflow-y-auto">
            {!exchanges.length && <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Select the full panel or one specialist, then ask your simulation question. Responses will appear here.</div>}
            {exchanges.map(exchange => (
              <article key={exchange.id} className="space-y-4">
                <div className="ml-auto max-w-3xl rounded-xl border border-primary/40 bg-primary/10 p-3 text-sm">
                  <p className="mb-1 text-[10px] uppercase tracking-wider text-primary">Your question · {exchange.choice === "panel" ? "full panel" : exchange.choice}</p>
                  <p className="whitespace-pre-wrap">{exchange.question}</p>
                </div>
                <div className="space-y-3 rounded-xl border border-border bg-background/80 p-4">
                  <p className="text-[10px] uppercase tracking-[.2em] text-primary">Gemini moderator · conditional analysis</p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{exchange.result.answer}</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {exchange.result.specialists.map(agent => (
                      <div key={agent.role} className="rounded-lg border border-border bg-primary/5 p-3">
                        <h3 className={"text-xs font-bold tracking-widest " + specialists[agent.role].accent}>{specialists[agent.role].label}</h3>
                        <p className="mt-2 text-sm font-medium">{agent.position}</p>
                        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{agent.reasoning}</p>
                      </div>
                    ))}
                  </div>
                  {!!exchange.result.disagreements.length && <div><p className="text-xs font-semibold text-primary">Points of disagreement</p><ul className="mt-2 list-inside list-disc text-xs leading-relaxed text-muted-foreground">{exchange.result.disagreements.map((v, i) => <li key={i}>{v}</li>)}</ul></div>}
                  {!!exchange.result.missing_evidence.length && <div><p className="text-xs font-semibold text-primary">Missing evidence</p><ul className="mt-2 list-inside list-disc text-xs leading-relaxed text-muted-foreground">{exchange.result.missing_evidence.map((v, i) => <li key={i}>{v}</li>)}</ul></div>}
                  {!!exchange.result.experiments.length && <div><p className="text-xs font-semibold text-primary">Next research tests</p><ul className="mt-2 list-inside list-disc text-xs leading-relaxed text-muted-foreground">{exchange.result.experiments.map((v, i) => <li key={i}>{v}</li>)}</ul></div>}
                  {!!exchange.result.evidence_ids.length && <p className="text-xs text-muted-foreground">References to supplied article IDs: {exchange.result.evidence_ids.map(id => id.slice(0, 12)).join(", ")}. Source data is app-provided; cross-check the linked articles above.</p>}
                </div>
              </article>
            ))}
          </div>
          <div>
            <p className="mb-2 text-xs uppercase tracking-wider text-primary">Suggested investigations</p>
            <div className="flex flex-wrap gap-2">{prompts.map(prompt => <button key={prompt} type="button"
              disabled={waiting} onClick={() => setQuestion(prompt)}
              className="rounded-lg border border-border px-3 py-2 text-left text-xs text-muted-foreground hover:border-primary hover:text-primary">{prompt}</button>)}</div>
          </div>
          <form onSubmit={event => { event.preventDefault(); void send(); }} className="space-y-3">
            <label htmlFor="simulation-chat-question" className="block text-sm font-semibold">Ask the simulation panel</label>
            <textarea id="simulation-chat-question" value={question} rows={3} maxLength={1500}
              disabled={waiting} onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
              className="w-full rounded-lg border border-border bg-background p-3 text-sm leading-relaxed"
              placeholder="What would invalidate this strategy if liquidity tightens?" />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button type="button" disabled={waiting || (!question && exchanges.length === 0)}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-xs text-muted-foreground disabled:opacity-40"
                onClick={() => { generation.current++; setQuestion(""); setExchanges([]); setError(""); setWaiting(false); setResponded(false); }}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />Clear conversation
              </button>
              <button type="submit" disabled={waiting || !question.trim() || !props.scenario.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40">
                <Send className="h-4 w-4" aria-hidden="true" />{waiting ? "Thinking..." : "Send question"}
              </button>
            </div>
          </form>
          {error && <p role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/40 p-3 text-sm text-destructive"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{error}</p>}
          <p className="text-xs text-muted-foreground">Per-user request quota applies. Gemini uses server-held credentials; chats are kept in this page session rather than written to a public database. Not investment advice or auto-trading.</p>
        </div>
      </div>
    </section>
  );
}
