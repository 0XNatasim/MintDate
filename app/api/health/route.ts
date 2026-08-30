import { NextResponse } from "next/server";
import { config } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness/readiness endpoint. Reports which providers are configured, but
 * NEVER exposes any secret value.
 */
export function GET() {
  return NextResponse.json({
    status: "ok",
    app: "mintdate",
    mockMode: config.mockMode,
    providers: {
      supabase: config.supabase.enabled,
      x: config.x.enabled,
      opensea: config.opensea.enabled,
      llm: config.openai.enabled
        ? {
            enabled: true,
            mode: config.openai.isLocal ? "local" : "openai",
            model: config.openai.model,
          }
        : { enabled: false, mode: "rule-based-fallback" },
    },
    time: new Date().toISOString(),
  });
}
