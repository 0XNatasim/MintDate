/**
 * Store selector + mock seeding.
 *
 * Chooses the Supabase store when configured and not in mock mode, otherwise
 * the in-memory store. In mock mode the memory store is seeded once with the
 * development fixtures so the dashboard has content on first load.
 */

import { config } from "@/lib/config";
import type { Store } from "./types";
import { MemoryStore } from "./memory";
import { SupabaseStore } from "./supabase";

let _store: Store | null = null;
let _seeded = false;

export function getStore(): Store {
  if (_store) return _store;
  if (config.supabase.enabled && !config.mockMode) {
    _store = new SupabaseStore();
  } else {
    _store = new MemoryStore();
  }
  return _store;
}

export type { Store } from "./types";
export * from "./types";

/**
 * Seed mock fixtures into the memory store on first access in mock mode. This
 * is a no-op for the Supabase store. Runs the real scan pipeline against the
 * mock X client so the seeded data is produced by the same code path users hit.
 */
export async function ensureSeeded(): Promise<void> {
  if (_seeded) return;
  _seeded = true;
  if (!config.mockMode) return;

  const { MOCK_ACCOUNTS } = await import("@/lib/mock/fixtures");
  const { runScan } = await import("@/lib/pipeline/scan");
  const store = getStore();
  for (const acct of MOCK_ACCOUNTS) {
    try {
      const existing = await store.getProjectByUsername(acct.username);
      if (existing) continue;
      const result = await runScan(acct.username);
      // Watch the first two demo accounts so the "watching" sections populate.
      if (["ExampleNFT", "FutureMint", "NoDateProject"].includes(acct.username)) {
        await store.setWatching(result.project.id, true);
      }
    } catch {
      // Seeding is best-effort; ignore individual failures.
    }
  }
}
