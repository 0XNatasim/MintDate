import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { config } from "@/lib/config";
import { normalizeXInput } from "@/lib/x/normalize";
import { runScan } from "@/lib/pipeline/scan";
import { ensureSeeded } from "@/lib/store";
import { errorResponse } from "@/lib/api/respond";
import { rateLimit, clientIpFromHeaders } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BodySchema = z.object({ input: z.string().min(1).max(2048) });

/**
 * POST /api/scan — the primary entrypoint. Rate limited per IP to protect
 * expensive X / OpenAI / OpenSea calls from abuse.
 */
export async function POST(req: NextRequest) {
  // Rate limit.
  const ip = clientIpFromHeaders(req.headers);
  const rl = rateLimit(`scan:${ip}`, config.rateLimit.scanMax, config.rateLimit.scanWindowSeconds);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many scans. Please wait a moment and try again.", code: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body.", code: "invalid_body" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "An X account is required.", code: "invalid_input" }, { status: 400 });
  }

  try {
    await ensureSeeded();
    const { username } = normalizeXInput(parsed.data.input);
    const result = await runScan(username);
    return NextResponse.json(result, {
      headers: { "X-RateLimit-Remaining": String(rl.remaining) },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
