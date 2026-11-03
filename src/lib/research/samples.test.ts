import { describe, expect, it } from "vitest";
import { DARPA_SOURCES, parseResearchEnvelope } from "./exchange";
import { createExampleResearchArtifact, exampleResearchEnvelope } from "./samples";

describe("nine-source research-exchange smoke fixtures", () => {
  it.each(DARPA_SOURCES)("parses the synthetic $id example", ({ id }) => {
    const parsed = parseResearchEnvelope(createExampleResearchArtifact(id));
    expect(parsed).toEqual(exampleResearchEnvelope(id));
    expect(parsed.scope).toBe("synthetic");
    expect(parsed.imported_status).toBe("UNVERIFIED_EXTERNAL_RESULT");
    expect(Object.keys(parsed.aggregates).length).toBeGreaterThan(0);
  });

  it("keeps each example distinct and labeled", () => {
    const ids = DARPA_SOURCES.map(({ id }) => parseResearchEnvelope(createExampleResearchArtifact(id)).source);
    expect(new Set(ids).size).toBe(9);
  });
});
