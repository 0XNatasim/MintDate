import { describe, it, expect } from "vitest";
import { mockExtract } from "./extract-mint";

const ctx = { username: "TestNFT", projectName: "Test NFT", postedAt: "2026-08-01T00:00:00Z" };

describe("mockExtract", () => {
  it("extracts a full public mint", () => {
    const r = mockExtract(
      "Public mint September 4 at 1 PM ET. 0.08 ETH · 3,333 supply on Ethereum. https://mint.test.xyz",
      ctx,
    );
    expect(r.mintFound).toBe(true);
    expect(r.opportunityType).toBe("public");
    expect(r.mintDateIso).toContain("2026-09-04");
    expect(r.timezone).toBe("ET");
    expect(r.price).toBe("0.08");
    expect(r.currency).toBe("ETH");
    expect(r.supply).toBe("3333");
    expect(r.chain).toBe("Ethereum");
    expect(r.officialMintUrl).toBe("https://mint.test.xyz");
    expect(r.confidence).toBe("high");
  });

  it("detects allowlist type", () => {
    const r = mockExtract("Allowlist mint September 5. WL only.", ctx);
    expect(r.opportunityType).toBe("allowlist");
  });

  it("NEVER invents a date from vague language", () => {
    const r = mockExtract("Mint soon frens. Stay tuned. Allowlist TBA.", ctx);
    expect(r.mintDateIso).toBeNull();
    expect(r.confidence).toBe("low");
  });

  it("returns mintFound=false for non-mint posts", () => {
    const r = mockExtract("gm. thanks for 10k followers!", ctx);
    expect(r.mintFound).toBe(false);
  });

  it("handles free mint", () => {
    const r = mockExtract("Free claim live now! https://x.xyz/claim", ctx);
    expect(r.mintFound).toBe(true);
    expect(["free", "claim"]).toContain(r.opportunityType);
    expect(r.price).toBe("0");
  });

  it("separates opensea url from mint url", () => {
    const r = mockExtract(
      "Mint September 4. https://mint.test.xyz and https://opensea.io/collection/test",
      ctx,
    );
    expect(r.officialMintUrl).toBe("https://mint.test.xyz");
    expect(r.openSeaUrl).toBe("https://opensea.io/collection/test");
  });
});
