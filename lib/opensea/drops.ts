/**
 * Cross-reference an X-discovered opportunity against OpenSea.
 *
 * We NEVER overwrite X data blindly. We compare the two sources:
 *   - agree (within tolerance)  -> opensea_verified
 *   - disagree                  -> conflicting  (surfaced visibly in the UI)
 *   - no OpenSea signal         -> x_only
 *
 * A conflict is never presented as "verified".
 */

import { config } from "@/lib/config";
import { getOpenSeaCollection, type OpenSeaCollection } from "./client";
import { isOpenSeaUrl, openSeaSlugFromUrl } from "@/lib/security/url";
import type { Opportunity, VerificationStatus } from "@/lib/types";

// Dates within this many minutes are considered "agreeing".
const AGREEMENT_TOLERANCE_MINUTES = 90;

export interface VerificationResult {
  status: VerificationStatus;
  collection: OpenSeaCollection | null;
  note: string | null;
}

function slugFor(opp: {
  opensea_url: string | null;
  openseaSlugHint?: string | null;
}): string | null {
  if (opp.opensea_url && isOpenSeaUrl(opp.opensea_url)) {
    const slug = openSeaSlugFromUrl(opp.opensea_url);
    if (slug) return slug;
  }
  return opp.openseaSlugHint ?? null;
}

/**
 * Mock verification derives an OpenSea date from deterministic per-slug rules
 * so the demo shows both a VERIFIED and a CONFLICTING project.
 */
function mockCollection(
  slug: string,
  opp: Pick<Opportunity, "mint_date" | "price" | "currency" | "supply">,
): OpenSeaCollection | null {
  const base = opp.mint_date ? new Date(opp.mint_date).getTime() : null;
  // Slugs containing "conflict" disagree by a day.
  const disagrees = /conflict/i.test(slug);

  if (base === null) {
    // The post carried no date — simulate a published OpenSea drop so the
    // backfill path is demoable. Deterministic: 3 days out at 16:00 UTC.
    const d = new Date();
    d.setUTCHours(16, 0, 0, 0);
    const mintDateUtc = new Date(d.getTime() + 3 * 86_400_000).toISOString();
    return {
      slug,
      name: null,
      url: `https://opensea.io/collection/${slug}`,
      mintDateUtc,
      price: opp.price ?? "0.02",
      currency: opp.currency ?? "ETH",
      supply: opp.supply ?? "1000",
    };
  }

  return {
    slug,
    name: null,
    url: `https://opensea.io/collection/${slug}`,
    mintDateUtc: new Date(base + (disagrees ? 86_400_000 : 0)).toISOString(),
    price: opp.price,
    currency: opp.currency,
    supply: opp.supply,
  };
}

export async function verifyOpportunity(
  opp: Pick<
    Opportunity,
    "mint_date" | "opensea_url" | "price" | "currency" | "supply"
  > & { openseaSlugHint?: string | null },
): Promise<VerificationResult> {
  const slug = slugFor(opp);
  if (!slug) {
    return { status: "x_only", collection: null, note: null };
  }

  // Fixtures are used ONLY in explicit mock mode — never as a silent fallback
  // in real mode (that would fabricate verification). In real mode without an
  // OpenSea key, getOpenSeaCollection returns null and we report x_only.
  const collection = config.mockMode
    ? mockCollection(slug, opp)
    : await getOpenSeaCollection(slug);

  if (!collection) {
    return { status: "x_only", collection: null, note: null };
  }

  // The post had no date but OpenSea publishes one: OpenSea is the source of
  // truth here. Adopt it (the pipeline backfills) and mark it verified.
  if (!opp.mint_date && collection.mintDateUtc) {
    return {
      status: "opensea_verified",
      collection,
      note: "Mint date sourced from OpenSea.",
    };
  }

  // Neither side has a comparable date — we only found the collection.
  if (!opp.mint_date || !collection.mintDateUtc) {
    return {
      status: "x_only",
      collection,
      note: "OpenSea collection found, but no comparable mint date.",
    };
  }

  const diffMinutes =
    Math.abs(
      new Date(opp.mint_date).getTime() - new Date(collection.mintDateUtc).getTime(),
    ) / 60000;

  if (diffMinutes <= AGREEMENT_TOLERANCE_MINUTES) {
    return { status: "opensea_verified", collection, note: null };
  }
  return {
    status: "conflicting",
    collection,
    note: `X and OpenSea mint times differ by ~${Math.round(diffMinutes / 60)}h.`,
  };
}
