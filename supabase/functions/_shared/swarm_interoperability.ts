/**
 * Bounded, typed evidence graph for synthetic Vulture Vision research-panel output.
 *
 * This checks structural interoperability and source-ID provenance only.
 * It does not establish semantic truth, causal validity, independent agents,
 * investor suitability, or calibrated predictive confidence.
 */
export type SwarmRole = "bull" | "bear" | "macro" | "risk";
export interface SwarmClaim {
  id: string;
  role: SwarmRole;
  position: string;
  assumptions: string[];
  invalidators: string[];
  evidence_ids: string[];
}
export interface SwarmSource {
  id: string;
  kind: "news_reference";
}
export interface SwarmEvidenceEdge {
  from: string;
  to: string;
  relation: "cites";
}
export interface SwarmEvidenceGraph {
  schema_version: "vv.swarm.semantic.v1";
  claims: SwarmClaim[];
  sources: SwarmSource[];
  edges: SwarmEvidenceEdge[];
  linked_claims: number;
  total_claims: number;
  limitations: string[];
  verification: "structure_and_source_ids_only";
}
export interface ClaimInput {
  role: SwarmRole;
  position: string;
  assumptions: string[];
  invalidators: string[];
  evidence_ids: string[];
}

/**
 * Each claim is linked only to a source ID supplied by the authenticated server.
 * The graph is bounded by the four-role panel and eight evidence items.
 * Citation is not evidence that a source supports a claim.
 */
export function buildSwarmEvidenceGraph(
  opinions: readonly ClaimInput[],
  allowedSourceIds: readonly string[],
): SwarmEvidenceGraph {
  const allowed = new Set(allowedSourceIds.slice(0, 8));
  const seenRoles = new Set<SwarmRole>();
  const claims: SwarmClaim[] = [];
  const cited = new Set<string>();
  const edges: SwarmEvidenceEdge[] = [];
  for (const opinion of opinions.slice(0, 4)) {
    if (seenRoles.has(opinion.role)) continue;
    seenRoles.add(opinion.role);
    const id = "claim:" + opinion.role;
    const evidence_ids = [...new Set(opinion.evidence_ids.filter(e => allowed.has(e)))].slice(0, 4);
    claims.push({
      id,
      role: opinion.role,
      position: opinion.position,
      assumptions: opinion.assumptions.slice(0, 3),
      invalidators: opinion.invalidators.slice(0, 3),
      evidence_ids,
    });
    for (const source of evidence_ids) {
      cited.add(source);
      edges.push({ from: id, to: "source:" + source, relation: "cites" });
    }
  }
  const limitations: string[] = [];
  if (!allowed.size) limitations.push("No server-resolved news sources were attached; claims are hypotheses.");
  if (claims.some(c => !c.evidence_ids.length)) limitations.push("Some analyst claims lack direct source links.");
  limitations.push("News IDs are resolved server-side, but citations and simulated reasoning do not establish factual or causal support.");
  return {
    schema_version: "vv.swarm.semantic.v1",
    claims,
    sources: [...cited].map(id => ({ id, kind: "news_reference" })),
    edges,
    linked_claims: claims.filter(c => c.evidence_ids.length > 0).length,
    total_claims: claims.length,
    limitations,
    verification: "structure_and_source_ids_only",
  };
}
