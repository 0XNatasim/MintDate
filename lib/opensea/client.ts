/**
 * OpenSea API client. Real path calls OpenSea API v2; mock path returns
 * fixture collections. Results are cached briefly (collection metadata rarely
 * changes) to control API usage.
 */

import { config } from "@/lib/config";
import { logger } from "@/lib/logger";

export interface OpenSeaCollection {
  slug: string;
  name: string | null;
  url: string;
  /** Absolute UTC ISO of the (next/primary) mint stage, if published. */
  mintDateUtc: string | null;
  price: string | null;
  currency: string | null;
  supply: string | null;
}

const API_BASE = "https://api.opensea.io/api/v2";
const TIMEOUT_MS = 10_000;

const cache = new Map<string, { value: OpenSeaCollection | null; at: number }>();
const TTL = 5 * 60 * 1000;

export async function getOpenSeaCollection(
  slug: string,
): Promise<OpenSeaCollection | null> {
  if (!slug) return null;
  const cached = cache.get(slug);
  if (cached && Date.now() - cached.at < TTL) return cached.value;

  let value: OpenSeaCollection | null = null;

  if (config.mockMode || !config.opensea.enabled) {
    value = null; // mock verification is handled by verify.ts using slug rules
  } else {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const res = await fetch(`${API_BASE}/collections/${encodeURIComponent(slug)}`, {
        headers: { "x-api-key": config.opensea.apiKey, accept: "application/json" },
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));

      if (res.ok) {
        const data = await res.json();
        value = {
          slug,
          name: data.name ?? null,
          url: `https://opensea.io/collection/${slug}`,
          mintDateUtc: data.drop?.stages?.[0]?.start_time
            ? new Date(data.drop.stages[0].start_time).toISOString()
            : null,
          price: data.drop?.stages?.[0]?.price?.value ?? null,
          currency: data.drop?.stages?.[0]?.price?.currency ?? null,
          supply: data.total_supply ? String(data.total_supply) : null,
        };
      } else if (res.status !== 404) {
        logger.warn("opensea_fetch_non_ok", { slug, status: res.status });
      }
    } catch (err) {
      logger.warn("opensea_fetch_failed", { slug, err });
      value = null;
    }
  }

  cache.set(slug, { value, at: Date.now() });
  return value;
}
