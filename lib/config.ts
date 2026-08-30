/**
 * Central runtime configuration. Reads environment variables once and
 * derives whether we run against real providers or in-memory mock fixtures.
 *
 * Mock mode is enabled when MINTDATE_MOCK_MODE=true (an explicit, clearly
 * labeled opt-in — the UI shows a MOCK MODE badge and /api/health reports it).
 * As a convenience it also turns on automatically when credentials are absent
 * in a NON-production environment, so `npm run dev` works out of the box.
 *
 * Crucially, mock mode is the ONLY thing that makes providers serve fixtures.
 * In production without MINTDATE_MOCK_MODE, missing credentials cause loud,
 * explicit errors rather than silently fabricated data.
 */

function boolEnv(value: string | undefined): boolean {
  return value?.toLowerCase() === "true" || value === "1";
}

function intEnv(value: string | undefined, fallback: number): number {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const isProd = process.env.NODE_ENV === "production";

const explicitMock = boolEnv(process.env.MINTDATE_MOCK_MODE);

const hasSupabase = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const hasX = Boolean(process.env.X_BEARER_TOKEN);
const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);

// In non-production, fall back to mock mode when core credentials are missing
// so the app is runnable with zero setup.
const impliedMock = !isProd && (!hasSupabase || !hasX || !hasOpenAI);

export const config = {
  isProd,
  mockMode: explicitMock || impliedMock,
  explicitMock,

  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    enabled: hasSupabase,
  },

  x: {
    bearerToken: process.env.X_BEARER_TOKEN ?? "",
    enabled: hasX,
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? "",
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    enabled: hasOpenAI,
  },

  opensea: {
    apiKey: process.env.OPENSEA_API_KEY ?? "",
    enabled: Boolean(process.env.OPENSEA_API_KEY),
  },

  cronSecret: process.env.CRON_SECRET ?? "",

  rateLimit: {
    scanMax: intEnv(process.env.RATE_LIMIT_SCAN_MAX, 10),
    scanWindowSeconds: intEnv(process.env.RATE_LIMIT_SCAN_WINDOW_SECONDS, 60),
  },
} as const;

export type AppConfig = typeof config;
