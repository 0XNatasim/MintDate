import { describe, it, expect } from "vitest";
import { MemoryStore } from "./memory";

function baseOpp(store: string, overrides: Record<string, unknown> = {}) {
  return {
    project_id: store,
    type: "public" as const,
    title: "T",
    mint_date: "2026-09-04T17:00:00.000Z",
    mint_end_date: null,
    timezone: "America/New_York",
    chain: "Ethereum",
    price: "0.08",
    currency: "ETH",
    supply: "3333",
    mint_url: null,
    opensea_url: null,
    source_post_id: "p1",
    source_post_url: "https://x.com/a/status/p1",
    source_text: "Mint Sep 4",
    confidence: "high" as const,
    verification_status: "x_only" as const,
    status: "announced" as const,
    ...overrides,
  };
}

describe("MemoryStore post dedup", () => {
  it("does not insert the same x_post_id twice", async () => {
    const store = new MemoryStore();
    const p = await store.upsertProject({
      x_username: "dedupU",
      x_user_id: "d1",
      name: null,
      description: null,
      avatar_url: null,
      profile_url: null,
    });
    const first = await store.insertNewPosts([
      { project_id: p.id, x_post_id: "dedup_1", text: "a", post_url: "u", posted_at: new Date().toISOString() },
    ]);
    const second = await store.insertNewPosts([
      { project_id: p.id, x_post_id: "dedup_1", text: "a", post_url: "u", posted_at: new Date().toISOString() },
    ]);
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(0);
  });
});

describe("MemoryStore opportunity merge", () => {
  it("merges a repeated announcement instead of duplicating", async () => {
    const store = new MemoryStore();
    const p = await store.upsertProject({
      x_username: "mergeU",
      x_user_id: "m1",
      name: "M",
      description: null,
      avatar_url: null,
      profile_url: null,
    });
    await store.upsertOpportunity(baseOpp(p.id, { source_post_id: "p1" }));
    // Same type + same day -> should merge, filling missing fields & keeping newest source.
    await store.upsertOpportunity(
      baseOpp(p.id, { source_post_id: "p2", source_text: "Reminder: mint tomorrow", opensea_url: "https://opensea.io/collection/x" }),
    );
    const opps = await store.getOpportunitiesByProject(p.id);
    expect(opps).toHaveLength(1);
    expect(opps[0].source_post_id).toBe("p2");
    expect(opps[0].opensea_url).toBe("https://opensea.io/collection/x");
  });

  it("keeps distinct phases separate", async () => {
    const store = new MemoryStore();
    const p = await store.upsertProject({
      x_username: "phaseU",
      x_user_id: "ph1",
      name: "P",
      description: null,
      avatar_url: null,
      profile_url: null,
    });
    await store.upsertOpportunity(baseOpp(p.id, { type: "allowlist" }));
    await store.upsertOpportunity(baseOpp(p.id, { type: "public" }));
    const opps = await store.getOpportunitiesByProject(p.id);
    expect(opps).toHaveLength(2);
  });
});
