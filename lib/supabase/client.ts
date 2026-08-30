/**
 * Supabase client factories.
 *
 * - `serviceClient()` uses the service-role key and MUST only ever be imported
 *   in server code (API routes, server components, cron). It bypasses RLS.
 * - `anonClient()` uses the public anon key (safe for the browser / RLS-guarded
 *   reads), kept here for future client-side reads.
 *
 * Both throw if the required env vars are missing, so misconfiguration fails
 * loudly instead of silently.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "@/lib/config";

let _service: SupabaseClient | null = null;

export function serviceClient(): SupabaseClient {
  if (!config.supabase.enabled) {
    throw new Error("Supabase is not configured (missing URL or service role key).");
  }
  if (!_service) {
    _service = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _service;
}

let _anon: SupabaseClient | null = null;

export function anonClient(): SupabaseClient {
  if (!config.supabase.url || !config.supabase.anonKey) {
    throw new Error("Supabase public config is missing.");
  }
  if (!_anon) {
    _anon = createClient(config.supabase.url, config.supabase.anonKey, {
      auth: { persistSession: false },
    });
  }
  return _anon;
}
