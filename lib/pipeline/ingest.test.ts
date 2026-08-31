import { describe, it, expect } from "vitest";
import { ingestManualText } from "./ingest";

describe("ingestManualText (free, no X API)", () => {
  it("extracts a mint from pasted text", async () => {
    const result = await ingestManualText({
      text: "Public mint September 4 at 1 PM ET. 0.08 ETH, 3333 supply on Ethereum. https://mint.foo.xyz",
      username: "FooNFT",
    });
    expect(result.project.x_username).toBe("FooNFT");
    expect(result.opportunities.length).toBe(1);
    const o = result.opportunities[0];
    expect(o.type).toBe("public");
    expect(o.mint_date).not.toBeNull();
    expect(o.price).toBe("0.08");
    expect(o.mint_url).toContain("mint.foo.xyz");
  });

  it("groups handle-less pastes under a Pasted Posts project and never invents data", async () => {
    const result = await ingestManualText({ text: "something is coming soon, stay tuned 👀" });
    expect(result.project.x_username).toBe("pasted");
    // Vague post → no invented date; likely no opportunity at all.
    for (const o of result.opportunities) {
      expect(o.mint_date).toBeNull();
    }
  });

  it("re-pasting the same text does not duplicate the opportunity", async () => {
    const text = "Allowlist mint October 2, 2026. WL only. https://mint.bar.xyz";
    const first = await ingestManualText({ text, username: "BarNFT" });
    const second = await ingestManualText({ text, username: "BarNFT" });
    expect(first.opportunities.length).toBe(1);
    expect(second.opportunities.length).toBe(1);
  });
});
