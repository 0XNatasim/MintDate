import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { config } from "@/lib/config";
import { normalizeXInput } from "@/lib/x/normalize";
import { ingestManualText, ingestFromSyndication } from "@/lib/pipeline/ingest";
import { errorResponse } from "@/lib/api/respond";
import { rateLimit, clientIpFromHeaders } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Free ingest endpoint — no paid X API required.
 *
 *   { text, url? }  → run extraction on pasted post text
 *   { url }         → fetch ONE tweet by status URL via keyless syndication
 *
 * A bare account handle/URL (no status id) is rejected here with guidance,
 * because listing a whole account timeline needs the paid X API.
 */
const BodySchema = z.object({
  text: z.string().max(4000).optional(),
  url: z.string().max(2048).optional(),
  username: z.string().max(50).optional(),
});

export async function POST(req: NextRequest) {
  const ip = clientIpFromHeaders(req.headers);
  const rl = rateLimit(`ingest:${ip}`, config.rateLimit.scanMax, config.rateLimit.scanWindowSeconds);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment.", code: "rate_limited" },
      { status: 429 },
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
    return NextResponse.json({ error: "Provide post text or a post URL.", code: "invalid_input" }, { status: 400 });
  }
  const { text, url } = parsed.data;

  try {
    // 1) Pasted text wins. An optional handle can come from a `username` field
    //    or be derived from a supplied post URL.
    if (text && text.trim()) {
      let username: string | undefined;
      let postUrl: string | undefined;
      if (parsed.data.username && parsed.data.username.trim()) {
        // Validate the handle (throws InvalidXInputError → clean 400).
        username = normalizeXInput(parsed.data.username).username;
      }
      if (url && url.trim()) {
        const norm = normalizeXInput(url); // validates it's a real x.com link
        username = username ?? norm.username;
        postUrl = url.trim();
      }
      const result = await ingestManualText({ text, username, postUrl });
      return NextResponse.json(result);
    }

    // 2) URL only → must be a specific post (has a status id).
    if (url && url.trim()) {
      const norm = normalizeXInput(url);
      if (!norm.postId) {
        return NextResponse.json(
          {
            error:
              "Free mode can scan a single post, not a whole account. Paste a specific post URL (x.com/user/status/…) or paste the post's text.",
            code: "account_needs_x_api",
          },
          { status: 400 },
        );
      }
      const result = await ingestFromSyndication(norm.postId);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Provide post text or a post URL.", code: "invalid_input" }, { status: 400 });
  } catch (err) {
    return errorResponse(err);
  }
}
