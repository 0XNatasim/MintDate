import { describe, it, expect } from "vitest";
import { isPotentiallyRelevant } from "./keywords";

describe("isPotentiallyRelevant", () => {
  it("flags obvious mint posts", () => {
    expect(isPotentiallyRelevant("Public mint is live!").relevant).toBe(true);
    expect(isPotentiallyRelevant("get on the allowlist").relevant).toBe(true);
    expect(isPotentiallyRelevant("free claim now").relevant).toBe(true);
  });

  it("ignores unrelated posts", () => {
    expect(isPotentiallyRelevant("gm frens, happy monday").relevant).toBe(false);
    expect(isPotentiallyRelevant("thanks for the support ❤️").relevant).toBe(false);
  });

  it("catches ticker + number context", () => {
    expect(isPotentiallyRelevant("0.08 eth soon").relevant).toBe(true);
  });
});
