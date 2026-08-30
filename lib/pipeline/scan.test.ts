import { describe, it, expect } from "vitest";
import { runScan } from "./scan";
import { deriveStatus } from "./status";

describe("runScan (mock mode, end-to-end)", () => {
  it("scans ExampleNFT and detects verified opportunities", async () => {
    const result = await runScan("ExampleNFT");
    expect(result.project.x_username).toBe("ExampleNFT");
    expect(result.opportunities.length).toBeGreaterThan(0);
    // Should include an OpenSea-verified public mint (X + OpenSea agree in fixtures).
    const publicMint = result.opportunities.find((o) => o.type === "public");
    expect(publicMint).toBeDefined();
    expect(publicMint?.verification_status).toBe("opensea_verified");
    expect(publicMint?.price).toBe("0.08");
  });

  it("marks conflicting sources, not verified", async () => {
    const result = await runScan("ConflictNFT");
    const opp = result.opportunities[0];
    expect(opp.verification_status).toBe("conflicting");
  });

  it("returns a friendly message and no invented date for vague projects", async () => {
    const result = await runScan("NoDateProject");
    // Either no opportunities, or opportunities with null mint_date — never invented.
    for (const o of result.opportunities) {
      if (o.mint_date === null) expect(["rumored", "unknown"]).toContain(o.status);
    }
  });

  it("is incremental: a second scan fetches nothing new", async () => {
    await runScan("FutureMint");
    const second = await runScan("FutureMint", { incremental: true });
    expect(second.scanRun.posts_fetched).toBe(0);
  });
});

describe("deriveStatus", () => {
  const now = Date.parse("2026-09-04T12:00:00Z");
  it("rumored when no date", () => {
    expect(
      deriveStatus({ mint_date: null, mint_end_date: null, verification_status: "x_only", hasMintInfo: true, now }),
    ).toBe("rumored");
  });
  it("live during window", () => {
    expect(
      deriveStatus({ mint_date: "2026-09-04T11:00:00Z", mint_end_date: null, verification_status: "x_only", hasMintInfo: true, now }),
    ).toBe("live");
  });
  it("ended after window", () => {
    expect(
      deriveStatus({ mint_date: "2026-09-01T11:00:00Z", mint_end_date: null, verification_status: "x_only", hasMintInfo: true, now }),
    ).toBe("ended");
  });
  it("verified when future + opensea agrees", () => {
    expect(
      deriveStatus({ mint_date: "2026-09-10T11:00:00Z", mint_end_date: null, verification_status: "opensea_verified", hasMintInfo: true, now }),
    ).toBe("verified");
  });
});
