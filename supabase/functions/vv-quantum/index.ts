// vv-quantum — quantum backend selector & status.
// Routes circuits to BlueQubit cloud when key present and n_qubits > local cap,
// otherwise runs analytic Born-rule sim locally in the edge runtime.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const LOCAL_QUBIT_CAP = 10;

type Req = {
  amplitudes?: number[];        // optional pre-built state vector (length 2^n)
  n_qubits?: number;            // for cloud routing decisions
  prefer?: "analytic" | "cloud" | "auto";
};

function analyticBornRule(amps: number[]) {
  // Normalize
  const norm = Math.sqrt(amps.reduce((a, b) => a + b * b, 0)) || 1;
  const psi = amps.map((a) => a / norm);
  const probs = psi.map((a) => a * a);
  // Shannon entropy (coherence proxy)
  const H = -probs.reduce((s, p) => s + (p > 0 ? p * Math.log2(p) : 0), 0);
  const maxH = Math.log2(probs.length);
  const coherence = maxH > 0 ? H / maxH : 0;
  return { probs, coherence, backend: "analytic_born_rule" as const };
}

async function bluequbitRun(amps: number[], nQubits: number, key: string) {
  // BlueQubit accepts Qiskit/Cirq circuits; for state-vector input we send a
  // lightweight statevector job. If the API call fails, caller will fall back.
  const r = await fetch("https://app.bluequbit.io/api/v1/jobs", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      device: "cpu",
      shots: 1024,
      job_type: "statevector",
      payload: { amplitudes: amps, n_qubits: nQubits },
    }),
  });
  if (!r.ok) throw new Error(`bluequbit ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return { ...j, backend: "bluequbit" as const };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const key = Deno.env.get("BLUEQUBIT_KEY") ?? "";
  const cloudAvailable = key.length > 0;

  // Status query
  if (req.method === "GET") {
    return new Response(JSON.stringify({
      backends: {
        analytic_born_rule: { available: true, max_qubits: LOCAL_QUBIT_CAP },
        bluequbit:          { available: cloudAvailable, max_qubits: 36 },
      },
      default: cloudAvailable ? "auto" : "analytic_born_rule",
      ts: new Date().toISOString(),
    }), { headers: corsHeaders });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Req;
    const amps = body.amplitudes ?? [1, 0];
    const nQubits = body.n_qubits ?? Math.max(1, Math.round(Math.log2(amps.length)));
    const prefer = body.prefer ?? "auto";

    const useCloud =
      prefer === "cloud" ||
      (prefer === "auto" && cloudAvailable && nQubits > LOCAL_QUBIT_CAP);

    if (useCloud && cloudAvailable) {
      try {
        const out = await bluequbitRun(amps, nQubits, key);
        return new Response(JSON.stringify({ ok: true, ...out, n_qubits: nQubits }), { headers: corsHeaders });
      } catch (e) {
        console.warn("[vv-quantum] cloud failed, falling back:", (e as Error).message);
      }
    }

    const out = analyticBornRule(amps);
    return new Response(JSON.stringify({ ok: true, ...out, n_qubits: nQubits }), { headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error).message) }), {
      status: 500, headers: corsHeaders,
    });
  }
});
