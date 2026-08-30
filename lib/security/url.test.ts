import { describe, it, expect } from "vitest";
import {
  isOpenSeaUrl,
  openSeaSlugFromUrl,
  sanitizeExternalUrl,
  displayHostname,
} from "./url";

describe("url safety", () => {
  it("recognizes OpenSea hosts", () => {
    expect(isOpenSeaUrl("https://opensea.io/collection/foo")).toBe(true);
    expect(isOpenSeaUrl("https://www.opensea.io/collection/foo")).toBe(true);
    expect(isOpenSeaUrl("https://opensea.io.evil.com/foo")).toBe(false);
    expect(isOpenSeaUrl("https://notopensea.io/foo")).toBe(false);
  });

  it("extracts collection slug", () => {
    expect(openSeaSlugFromUrl("https://opensea.io/collection/cool-cats")).toBe("cool-cats");
    expect(openSeaSlugFromUrl("https://opensea.io/foo")).toBeNull();
  });

  it("rejects non-http protocols (SSRF/scheme abuse)", () => {
    expect(sanitizeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(sanitizeExternalUrl("file:///etc/passwd")).toBeNull();
    expect(sanitizeExternalUrl("data:text/html,x")).toBeNull();
  });

  it("accepts valid https urls", () => {
    expect(sanitizeExternalUrl("https://mint.example.xyz/go")).toBe(
      "https://mint.example.xyz/go",
    );
  });

  it("computes display hostname without www", () => {
    expect(displayHostname("https://www.mint.example.xyz/go")).toBe("mint.example.xyz");
  });
});
