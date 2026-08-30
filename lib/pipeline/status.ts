/**
 * Derives an opportunity's lifecycle status from its date + verification. Kept
 * pure and separate so it can be unit-tested and recomputed on read (a mint
 * that was "announced" becomes "live" then "ended" purely with the passage of
 * time, without a rescan).
 */

import type {
  OpportunityStatus,
  VerificationStatus,
} from "@/lib/types";

// How long after start (when no explicit end) we still consider a mint "live".
const DEFAULT_LIVE_WINDOW_MS = 6 * 60 * 60 * 1000;

export function deriveStatus(input: {
  mint_date: string | null;
  mint_end_date: string | null;
  verification_status: VerificationStatus;
  hasMintInfo: boolean;
  now?: number;
}): OpportunityStatus {
  const now = input.now ?? Date.now();

  if (!input.mint_date) {
    // Timing referenced but no concrete date -> rumored; otherwise announced.
    return input.hasMintInfo ? "rumored" : "unknown";
  }

  const start = new Date(input.mint_date).getTime();
  if (Number.isNaN(start)) return "announced";
  const end = input.mint_end_date
    ? new Date(input.mint_end_date).getTime()
    : start + DEFAULT_LIVE_WINDOW_MS;

  if (now > end) return "ended";
  if (now >= start) return "live";

  // Future, upcoming.
  if (input.verification_status === "opensea_verified") return "verified";
  return "announced";
}
