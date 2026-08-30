import { describe, it, expect } from "vitest";
import { normalizeMintDate, resolveTimezone, formatInZone } from "./timezone";

describe("resolveTimezone", () => {
  it("maps abbreviations to IANA", () => {
    expect(resolveTimezone("ET")).toBe("America/New_York");
    expect(resolveTimezone("EST")).toBe("America/New_York");
    expect(resolveTimezone("EDT")).toBe("America/New_York");
    expect(resolveTimezone("PST")).toBe("America/Los_Angeles");
    expect(resolveTimezone("UTC")).toBe("UTC");
  });
  it("passes through valid IANA zones", () => {
    expect(resolveTimezone("America/Chicago")).toBe("America/Chicago");
  });
  it("returns null for unknown", () => {
    expect(resolveTimezone("Narnia/Cair")).toBeNull();
    expect(resolveTimezone(null)).toBeNull();
  });
});

describe("normalizeMintDate", () => {
  it("respects explicit UTC offset", () => {
    const r = normalizeMintDate("2026-09-04T17:00:00Z", null);
    expect(r?.utc).toBe("2026-09-04T17:00:00.000Z");
  });

  it("interprets naive time in ET during DST (EDT, -04:00)", () => {
    // Sept 4 is EDT (-4). 1 PM ET => 17:00 UTC.
    const r = normalizeMintDate("2026-09-04T13:00:00", "ET");
    expect(r?.utc).toBe("2026-09-04T17:00:00.000Z");
    expect(r?.timezone).toBe("America/New_York");
  });

  it("interprets naive time in ET during winter (EST, -05:00)", () => {
    // Jan 4 is EST (-5). 1 PM ET => 18:00 UTC. Proves DST is honored, not hardcoded.
    const r = normalizeMintDate("2026-01-04T13:00:00", "EST");
    expect(r?.utc).toBe("2026-01-04T18:00:00.000Z");
  });

  it("defaults to UTC when no zone given (never guesses EST)", () => {
    const r = normalizeMintDate("2026-09-04T13:00:00", null);
    expect(r?.utc).toBe("2026-09-04T13:00:00.000Z");
    expect(r?.timezone).toBeNull();
  });

  it("returns null for empty/invalid", () => {
    expect(normalizeMintDate(null, "ET")).toBeNull();
    expect(normalizeMintDate("not a date", "ET")).toBeNull();
  });
});

describe("formatInZone", () => {
  it("formats in source zone with short label", () => {
    const out = formatInZone("2026-09-04T17:00:00Z", "America/New_York");
    expect(out).toContain("SEP 4");
    expect(out).toContain("1:00 PM");
    expect(out).toContain("ET");
  });
});
