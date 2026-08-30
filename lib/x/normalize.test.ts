import { describe, it, expect } from "vitest";
import { normalizeXInput, InvalidXInputError } from "./normalize";

describe("normalizeXInput", () => {
  it("handles @handle", () => {
    expect(normalizeXInput("@MancerXYZ")).toEqual({ username: "MancerXYZ" });
  });

  it("handles bare handle", () => {
    expect(normalizeXInput("MancerXYZ")).toEqual({ username: "MancerXYZ" });
  });

  it("handles x.com url", () => {
    expect(normalizeXInput("https://x.com/MancerXYZ")).toEqual({ username: "MancerXYZ" });
  });

  it("handles twitter.com url", () => {
    expect(normalizeXInput("https://twitter.com/MancerXYZ")).toEqual({
      username: "MancerXYZ",
    });
  });

  it("handles status url and extracts postId", () => {
    expect(normalizeXInput("https://x.com/MancerXYZ/status/123")).toEqual({
      username: "MancerXYZ",
      postId: "123",
    });
  });

  it("handles url without protocol", () => {
    expect(normalizeXInput("x.com/MancerXYZ")).toEqual({ username: "MancerXYZ" });
  });

  it("handles intent links", () => {
    expect(normalizeXInput("https://x.com/intent/user?screen_name=Foo")).toEqual({
      username: "Foo",
    });
  });

  it("strips trailing whitespace", () => {
    expect(normalizeXInput("  @Foo  ")).toEqual({ username: "Foo" });
  });

  it("rejects invalid usernames", () => {
    expect(() => normalizeXInput("has spaces")).toThrow(InvalidXInputError);
    expect(() => normalizeXInput("waytoolongusername123")).toThrow(InvalidXInputError);
    expect(() => normalizeXInput("bad!char")).toThrow(InvalidXInputError);
  });

  it("rejects reserved paths", () => {
    expect(() => normalizeXInput("https://x.com/home")).toThrow(InvalidXInputError);
    expect(() => normalizeXInput("https://x.com/search")).toThrow(InvalidXInputError);
  });

  it("rejects non-x hosts (SSRF guard)", () => {
    expect(() => normalizeXInput("https://evil.com/foo")).toThrow(InvalidXInputError);
    expect(() => normalizeXInput("http://169.254.169.254/latest")).toThrow(InvalidXInputError);
  });

  it("rejects empty input", () => {
    expect(() => normalizeXInput("")).toThrow(InvalidXInputError);
  });
});
