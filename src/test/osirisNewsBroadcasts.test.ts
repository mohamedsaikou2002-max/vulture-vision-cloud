import { describe, expect, it } from "vitest";
import { osirisLiveNewsChannels } from "@/data/osirisLiveNewsChannels";

describe("OSIRIS external broadcaster directory", () => {
  it("provides only 15 identified news broadcasters as outbound links", () => {
    expect(osirisLiveNewsChannels).toHaveLength(15);
    expect(new Set(osirisLiveNewsChannels.map(c => c.id)).size).toBe(15);
    expect(osirisLiveNewsChannels.map(c => c.name)).toContain("Bloomberg TV");
    expect(osirisLiveNewsChannels.map(c => c.name)).toContain("Al Jazeera EN");
    for (const channel of osirisLiveNewsChannels) {
      const url = new URL(channel.url);
      expect(url.protocol).toBe("https:");
      expect(["www.youtube.com", "rumble.com"]).toContain(url.hostname);
      expect(url.pathname).not.toMatch(/aircraft|flights|adsb|camera|cctv|maritime|satellite|weather|scanner/i);
      expect(channel.language).toBe("en");
    }
  });
});
