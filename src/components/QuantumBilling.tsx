import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchQuantumJobs, requestQuantumQuote, authorizeQuantumJob, dispatchQuantumJob,
  cancelQuantumJob, formatCents, newIdempotencyKey,
  type QuantumJob, type QuantumJobsResponse,
} from "@/lib/quantumJobsApi";

/**
 * Quantum Usage & Billing — optional IBM Quantum pay-per-job comparison.
 * Classical analysis is the default and is never charged. The IBM toggle is
 * OFF by default; a paid job can only be submitted after an explicit click
 * authorizing a maximum charge, and only when payment processing is
 * configured server-side. Estimates are clearly marked as estimates.
 */
function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    const detail = (error as Error & { detail?: { error?: string } }).detail;
    return detail?.error || error.message || fallback;
  }
  return fallback;
}

export default function QuantumBilling() {
  const [data, setData] = useState<QuantumJobsResponse | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [compareOn, setCompareOn] = useState(false); // paid toggle — OFF by default
  const [qubits, setQubits] = useState(8);
  const [shots, setShots] = useState(1024);
  const [capDollars, setCapDollars] = useState("5.00");
  const [pendingJob, setPendingJob] = useState<QuantumJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const idemKey = useRef<string>(newIdempotencyKey());

  const load = useCallback(async () => {
    try {
      setData(await fetchQuantumJobs());
      setLoadErr(null);
    } catch (e: unknown) {
      setLoadErr(errorMessage(e, "") === "auth_required" ? "Sign in to view quantum usage." : "Quantum billing service unavailable.");
    }
  }, []);

  useEffect(() => { load(); const id = setInterval(load, 30_000); return () => clearInterval(id); }, [load]);

  const cfg = data?.config;
  const cur = cfg?.currency || "usd";

  async function getQuote() {
    setBusy(true); setActionErr(null);
    try {
      const res = await requestQuantumQuote({
        n_qubits: qubits, shots, idempotency_key: idemKey.current,
        strategy_hash: "vv-classical-v1", data_hash: "frozen-snapshot",
      });
      setPendingJob(res.job);
      if (!res.replay) idemKey.current = newIdempotencyKey(); // next submission gets a fresh key
    } catch (e: unknown) { setActionErr(errorMessage(e, "quote_failed")); }
    setBusy(false);
  }

  async function authorizeAndDispatch() {
    if (!pendingJob) return;
    setBusy(true); setActionErr(null);
    try {
      const capCents = Math.round(parseFloat(capDollars || "0") * 100);
      const auth = await authorizeQuantumJob(pendingJob.id, capCents);
      const disp = await dispatchQuantumJob(auth.job.id);
      setPendingJob(null);
      await load();
      if (!disp.job) setActionErr("dispatch_failed");
    } catch (e: unknown) {
      setActionErr(errorMessage(e, "authorization_failed"));
      await load();
    }
    setBusy(false);
  }

  async function cancel(jobId: string) {
    setBusy(true);
    try { await cancelQuantumJob(jobId); setPendingJob(null); await load(); } catch { /* surfaced on reload */ }
    setBusy(false);
  }

  const errText = (code: string | null) => {
    if (!code) return null;
    if (code === "stripe_not_configured" || code === "stripe_adapter_not_deployed" || code === "payment_authorization_failed")
      return "PAYMENT NOT CONFIGURED — paid IBM jobs cannot be submitted until payment processing is set up. No charge was made.";
    if (code === "ibm_not_configured" || code === "ibm_adapter_not_deployed")
      return "IBM QUANTUM NOT CONFIGURED — hardware dispatch is unavailable. No charge was made.";
    if (code === "quote_expired") return "QUOTE EXPIRED — request a fresh quote.";
    if (code === "cap_below_quote") return "CAP BELOW QUOTE — raise your maximum spending cap or lower the job size.";
    return code.toUpperCase().replace(/_/g, " ");
  };

  return (
    <div className="panel" style={{ marginTop: 14 }}>
      <div className="panel-title">QUANTUM USAGE &amp; BILLING — OPTIONAL IBM HARDWARE COMPARISON</div>

      <div style={{ fontSize: 9, color: "var(--dim)", letterSpacing: "0.08em", marginBottom: 10, lineHeight: 1.6 }}>
        CLASSICAL ANALYSIS IS THE DEFAULT AND IS NEVER CHARGED. IBM QUANTUM HARDWARE IS STRICTLY OPTIONAL,
        PAY-PER-JOB, AND NEVER PART OF YOUR SUBSCRIPTION. ESTIMATES CAN DIFFER FROM ACTUAL METERED QPU USAGE —
        YOU AUTHORIZE A MAXIMUM CAP AND ARE NEVER CHARGED ABOVE IT. YOU MAKE YOUR OWN TRADING DECISIONS; NO AUTO-TRADING.
      </div>

      {/* config status */}
      <div style={{ display: "flex", gap: 14, fontSize: 9, letterSpacing: "0.12em", marginBottom: 10 }}>
        <span style={{ color: cfg?.stripe_configured ? "var(--green-bright)" : "#ff2222" }}>
          PAYMENTS: {cfg ? (cfg.stripe_configured ? "CONFIGURED" : "NOT CONFIGURED") : "…"}
        </span>
        <span style={{ color: cfg?.ibm_configured ? "var(--green-bright)" : "#ff2222" }}>
          IBM QUANTUM: {cfg ? (cfg.ibm_configured ? "CONFIGURED" : "NOT CONFIGURED") : "…"}
        </span>
        <span style={{ color: "var(--dim)" }}>MARKUP: {cfg ? cfg.markup_bp / 100 : "…"}%</span>
      </div>

      {loadErr && <div style={{ color: "#ff2222", fontSize: 10, marginBottom: 8 }}>{loadErr}</div>}

      {/* paid comparison toggle — OFF by default */}
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10, letterSpacing: "0.1em", cursor: "pointer", marginBottom: 10 }}>
        <input type="checkbox" checked={compareOn} onChange={(e) => setCompareOn(e.target.checked)} style={{ accentColor: "var(--gold)" }} />
        <span style={{ color: compareOn ? "var(--gold)" : "var(--dim)" }}>
          COMPARE WITH IBM QUANTUM (PAID, PER-JOB) — {compareOn ? "ON" : "OFF"}
        </span>
      </label>

      {compareOn && (
        <div style={{ border: "1px solid var(--gold-dim)", padding: 12, marginBottom: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 9, letterSpacing: "0.15em", color: "var(--dim)", marginBottom: 4 }}>
                QUBITS — {qubits}
              </label>
              <input type="range" min={2} max={cfg?.max_qubits || 36} value={qubits}
                onChange={(e) => setQubits(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--gold)" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 9, letterSpacing: "0.15em", color: "var(--dim)", marginBottom: 4 }}>
                SHOTS — {shots}
              </label>
              <input type="range" min={128} max={8192} step={128} value={shots}
                onChange={(e) => setShots(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--gold)" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 9, letterSpacing: "0.15em", color: "var(--dim)", marginBottom: 4 }}>
                MAX SPENDING CAP (USD)
              </label>
              <input type="number" min="0.01" step="0.01" value={capDollars}
                onChange={(e) => setCapDollars(e.target.value)}
                style={{ width: "100%", background: "rgba(0,0,0,0.4)", border: "1px solid var(--gold-dim)", color: "var(--green-bright)", fontFamily: "inherit", fontSize: 11, padding: "4px 6px" }} />
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
            <button className="sim-btn" disabled={busy} onClick={getQuote}>GET COST QUOTE</button>
            {pendingJob && (
              <>
                <span style={{ fontSize: 10, color: "var(--gold)" }}>
                  ESTIMATED: {formatCents(pendingJob.quote_cents, cur)} ({pendingJob.est_qpu_secs}s QPU est.) — EXPIRES {pendingJob.quote_expires_at ? new Date(pendingJob.quote_expires_at).toLocaleTimeString() : "—"}
                </span>
                <button className="sim-btn sim-btn-go" disabled={busy} onClick={authorizeAndDispatch}>
                  AUTHORIZE MAX {formatCents(Math.round(parseFloat(capDollars || "0") * 100), cur)} &amp; RUN
                </button>
                <button className="sim-btn sim-btn-stop" disabled={busy} onClick={() => cancel(pendingJob.id)}>CANCEL</button>
              </>
            )}
          </div>
          {actionErr && <div style={{ color: "#ff2222", fontSize: 10, marginTop: 8, letterSpacing: "0.05em" }}>{errText(actionErr)}</div>}

          {/* side-by-side comparability: only with real independent backtests */}
          <div style={{ fontSize: 9, color: "var(--dim)", marginTop: 10, letterSpacing: "0.06em" }}>
            SIDE-BY-SIDE RESULTS APPEAR ONLY WHEN INDEPENDENT CLASSICAL AND IBM BACKTESTS EXIST ON THE SAME FROZEN
            DATASET, STRATEGY VERSION, COST MODEL AND SAMPLE PERIOD — OTHERWISE SHOWN AS PENDING/UNAVAILABLE.
          </div>
        </div>
      )}

      {/* period totals */}
      {data && (
        <div style={{ display: "flex", gap: 16, fontSize: 9, letterSpacing: "0.12em", color: "var(--dim)", marginBottom: 8 }}>
          <span>THIS MONTH: <span style={{ color: "var(--gold)" }}>{data.period_totals.jobs} JOBS</span></span>
          <span>CHARGED: <span style={{ color: "var(--gold)" }}>{formatCents(data.period_totals.charged_cents, cur)}</span></span>
          <span>REFUNDED: <span style={{ color: "var(--green-bright)" }}>{formatCents(data.period_totals.refunded_cents, cur)}</span></span>
          <span>QPU TIME: <span style={{ color: "var(--gold)" }}>{data.period_totals.qpu_secs.toFixed(3)}s</span></span>
          <span>PENDING: <span style={{ color: "var(--gold)" }}>{data.period_totals.pending}</span></span>
        </div>
      )}

      {/* per-job ledger table */}
      <div style={{ overflowX: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>JOB</th><th>STATUS</th><th>SIZE</th><th>ESTIMATE</th><th>CAP</th>
              <th>METERED QPU</th><th>CHARGE</th><th>SETTLEMENT</th><th>CREATED</th><th></th>
            </tr>
          </thead>
          <tbody>
            {!data?.jobs.length && (
              <tr><td colSpan={10} className="empty-cell">No paid quantum jobs — classical analysis runs free by default.</td></tr>
            )}
            {data?.jobs.map((j) => (
              <tr key={j.id}>
                <td style={{ color: "var(--dim)" }}>{j.id.slice(0, 8)}</td>
                <td style={{ color: j.status === "settled" ? "var(--green-bright)" : ["failed", "cancelled", "expired"].includes(j.status) ? "#ff2222" : "var(--gold)" }}>
                  {j.status.toUpperCase()}
                </td>
                <td>{j.n_qubits}q × {j.shots}</td>
                <td>{formatCents(j.quote_cents, j.currency)}</td>
                <td>{formatCents(j.approved_cap_cents, j.currency)}</td>
                <td>{j.provider_reported_qpu_secs != null ? `${j.provider_reported_qpu_secs}s` : "—"}</td>
                <td>{formatCents(j.charge_cents, j.currency)}{j.refund_cents > 0 ? ` (−${formatCents(j.refund_cents, j.currency)})` : ""}</td>
                <td style={{ color: j.settlement_status === "settled" ? "var(--green-bright)" : "var(--dim)" }}>{j.settlement_status.toUpperCase()}</td>
                <td style={{ color: "var(--dim)" }}>{new Date(j.created_at).toLocaleString()}</td>
                <td>{["quoted", "authorized"].includes(j.status) && (
                  <button className="sim-btn sim-btn-stop" style={{ padding: "2px 6px", fontSize: 8 }} disabled={busy} onClick={() => cancel(j.id)}>✕</button>
                )}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
