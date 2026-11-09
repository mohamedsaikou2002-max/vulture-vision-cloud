import { transferableAbortController } from "node:util";
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { loadEdgeHandler } from "./helpers/edgeHarness";

beforeAll(() => vi.stubGlobal("AbortSignal", transferableAbortController().signal.constructor));
afterAll(() => vi.unstubAllGlobals());
const req = (token?: string) => new Request("https://fixture.invalid", {
  method: "POST",
  headers: token ? { authorization: "Bearer " + token } : {},
  body: JSON.stringify({ message: "Hypothetical Nasdaq rate hike?", history: [] }),
});
describe("Paid Intel research access", () => {
  it("rejects anonymous requests before issuing any provider calls", async () => {
    const fetcher = vi.fn();
    const handler = loadEdgeHandler("vv-chat", fetcher, {
      SUPABASE_URL: "https://fixture.supabase.co", SUPABASE_ANON_KEY: "public", SUPABASE_SERVICE_ROLE_KEY: "service", GEMINI_API_KEY: "fixture-key",
    }, () => ({}));
    const response = await handler(req());
    expect(response.status).toBe(401);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects valid logins without a server-confirmed paid subscription", async () => {
    const fetcher = vi.fn();
    const client = vi.fn()
      .mockReturnValueOnce({ auth: { getUser: async () => ({ data: { user: { id: "member", is_anonymous: false } }, error: null }) } })
      .mockReturnValueOnce({ rpc: async () => ({ data: false, error: null }) });
    const handler = loadEdgeHandler("vv-chat", fetcher, {
      SUPABASE_URL: "https://fixture.supabase.co", SUPABASE_ANON_KEY: "public", SUPABASE_SERVICE_ROLE_KEY: "service", GEMINI_API_KEY: "fixture-key",
    }, client);
    const response = await handler(req("valid-member-token"));
    expect(response.status).toBe(402);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("answers authenticated paid members with source-bound AI", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ candidates: [{ content: { parts: [{ text: "A hypothetical risk, not a forecast." }] } }] }));
    const response = await loadEdgeHandler("vv-chat", fetcher,
      { GEMINI_API_KEY: "fixture-key", __TEST_MEMBER_ID: "member" },
      () => ({}))(req("fixture-member"));
    expect(response.status).toBe(200);
    expect((await response.json()).reply).toBe("A hypothetical risk, not a forecast.");
  });

  it("reports unavailable AI only after authenticating the member", async () => {
    const fetcher = vi.fn();
    const response = await loadEdgeHandler("vv-chat", fetcher,
      { __TEST_MEMBER_ID: "member" },
      () => ({}))(req("fixture-member"));
    expect(response.status).toBe(503);
    expect((await response.json()).error).toContain("not configured");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
