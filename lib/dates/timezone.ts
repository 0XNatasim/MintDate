/**
 * Timezone + date normalization.
 *
 * Design:
 *   - We persist mint times as absolute UTC ISO timestamps (`mint_date`).
 *   - We separately persist the IANA zone the source expressed the time in
 *     (`timezone`, e.g. "America/New_York") so the UI can show "1:00 PM ET"
 *     faithfully AND offer the viewer's local time.
 *   - We NEVER hardcode a fixed EST offset. date-fns-tz resolves the correct
 *     offset for the specific date, honoring DST boundaries.
 *
 * The AI extractor returns an ISO-8601 string plus an optional timezone. That
 * ISO string may be:
 *   - absolute (ends in Z or has a ±hh:mm offset)  -> used as-is
 *   - naive local ("2026-09-04T13:00:00")          -> interpreted in `timezone`
 */

import { fromZonedTime, toZonedTime, format as formatTz } from "date-fns-tz";

/** Common ticker/abbreviation -> IANA zone. Case-insensitive keys. */
const ABBREV_TO_IANA: Record<string, string> = {
  ET: "America/New_York",
  EST: "America/New_York",
  EDT: "America/New_York",
  CT: "America/Chicago",
  CST: "America/Chicago",
  CDT: "America/Chicago",
  MT: "America/Denver",
  MST: "America/Denver",
  MDT: "America/Denver",
  PT: "America/Los_Angeles",
  PST: "America/Los_Angeles",
  PDT: "America/Los_Angeles",
  GMT: "UTC",
  UTC: "UTC",
  BST: "Europe/London",
  CET: "Europe/Paris",
  CEST: "Europe/Paris",
  JST: "Asia/Tokyo",
  KST: "Asia/Seoul",
  SGT: "Asia/Singapore",
  IST: "Asia/Kolkata",
  AEST: "Australia/Sydney",
  AEDT: "Australia/Sydney",
};

const IANA_RE = /^[A-Za-z]+\/[A-Za-z0-9_+\-/]+$/;

/** Resolve a timezone string (abbreviation or IANA) to an IANA zone, or null. */
export function resolveTimezone(tz: string | null | undefined): string | null {
  if (!tz) return null;
  const trimmed = tz.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  if (ABBREV_TO_IANA[upper]) return ABBREV_TO_IANA[upper];
  if (IANA_RE.test(trimmed)) {
    // Validate against Intl; invalid zones throw.
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: trimmed });
      return trimmed;
    } catch {
      return null;
    }
  }
  return null;
}

const HAS_OFFSET_RE = /(Z|[+-]\d{2}:?\d{2})$/;

export interface NormalizedDate {
  /** Absolute UTC ISO timestamp. */
  utc: string;
  /** IANA zone the source expressed, if known. */
  timezone: string | null;
}

/**
 * Normalize an extracted ISO date + optional timezone to an absolute UTC
 * timestamp. Returns null when the input cannot be parsed — we NEVER invent a
 * time.
 */
export function normalizeMintDate(
  isoText: string | null | undefined,
  timezone: string | null | undefined,
): NormalizedDate | null {
  if (!isoText || typeof isoText !== "string") return null;
  const iso = isoText.trim();
  if (!iso) return null;

  const zone = resolveTimezone(timezone);

  // Absolute instant: trust the offset embedded in the string.
  if (HAS_OFFSET_RE.test(iso)) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return { utc: d.toISOString(), timezone: zone };
  }

  // Naive local time. Interpret in the resolved zone; default to UTC when the
  // source gave no zone (we do NOT guess EST).
  const interpretIn = zone ?? "UTC";
  try {
    const utcDate = fromZonedTime(iso, interpretIn);
    if (Number.isNaN(utcDate.getTime())) return null;
    return { utc: utcDate.toISOString(), timezone: zone };
  } catch {
    return null;
  }
}

const ABBREV_BY_ZONE: Record<string, string> = {
  "America/New_York": "ET",
  "America/Chicago": "CT",
  "America/Denver": "MT",
  "America/Los_Angeles": "PT",
  "Europe/London": "UK",
  "Europe/Paris": "CET",
  "Asia/Tokyo": "JST",
  "Asia/Seoul": "KST",
  "Asia/Singapore": "SGT",
  "Asia/Kolkata": "IST",
  "Australia/Sydney": "AEST",
  UTC: "UTC",
};

export function shortZoneLabel(zone: string | null): string {
  if (!zone) return "UTC";
  return ABBREV_BY_ZONE[zone] ?? zone.split("/").pop() ?? zone;
}

/** Format a UTC ISO timestamp in a given zone, e.g. "SEP 4 · 1:00 PM ET". */
export function formatInZone(utcIso: string, zone: string | null): string {
  const date = new Date(utcIso);
  if (Number.isNaN(date.getTime())) return "";
  const target = zone ?? "UTC";
  const zoned = toZonedTime(date, target);
  const datePart = formatTz(zoned, "MMM d", { timeZone: target }).toUpperCase();
  const timePart = formatTz(zoned, "h:mm a", { timeZone: target });
  return `${datePart} · ${timePart} ${shortZoneLabel(zone)}`;
}
