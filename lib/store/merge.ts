/**
 * Opportunity de-duplication / merge logic.
 *
 * A project may tweet about the same mint many times ("Mint Sep 4" then
 * "Reminder: mint tomorrow"). We must NOT create duplicate opportunities, but
 * we MUST keep genuinely distinct phases (allowlist vs public) separate.
 *
 * Matching rule: same project + same type + same calendar day (in UTC) OR
 * both dates unknown. When matched we update the existing row, preferring the
 * newest non-null evidence.
 */

import type { Opportunity } from "@/lib/types";
import type { UpsertOpportunityInput } from "./types";

function dayKey(iso: string | null): string {
  if (!iso) return "unknown";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown";
  return d.toISOString().slice(0, 10);
}

export function opportunitiesMatch(
  a: Pick<Opportunity, "type" | "mint_date">,
  b: Pick<UpsertOpportunityInput, "type" | "mint_date">,
): boolean {
  if (a.type !== b.type) return false;
  return dayKey(a.mint_date) === dayKey(b.mint_date);
}

/** Prefer the newer non-null value; fall back to the existing one. */
function pick<T>(incoming: T | null, existing: T | null): T | null {
  return incoming ?? existing;
}

export function mergeOpportunity(
  existing: Opportunity,
  input: UpsertOpportunityInput,
  now: string,
): Opportunity {
  return {
    ...existing,
    title: pick(input.title, existing.title),
    mint_date: pick(input.mint_date, existing.mint_date),
    mint_end_date: pick(input.mint_end_date, existing.mint_end_date),
    timezone: pick(input.timezone, existing.timezone),
    chain: pick(input.chain, existing.chain),
    price: pick(input.price, existing.price),
    currency: pick(input.currency, existing.currency),
    supply: pick(input.supply, existing.supply),
    mint_url: pick(input.mint_url, existing.mint_url),
    opensea_url: pick(input.opensea_url, existing.opensea_url),
    // Keep the newest source evidence.
    source_post_id: input.source_post_id ?? existing.source_post_id,
    source_post_url: input.source_post_url ?? existing.source_post_url,
    source_text: input.source_text ?? existing.source_text,
    // Confidence & verification: take the stronger signal.
    confidence: strongerConfidence(existing.confidence, input.confidence),
    verification_status: input.verification_status,
    status: input.status,
    updated_at: now,
  };
}

const CONFIDENCE_RANK = { low: 0, medium: 1, high: 2 } as const;

function strongerConfidence(
  a: Opportunity["confidence"],
  b: Opportunity["confidence"],
): Opportunity["confidence"] {
  return CONFIDENCE_RANK[a] >= CONFIDENCE_RANK[b] ? a : b;
}
