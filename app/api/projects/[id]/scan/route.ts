import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { getStore } from "@/lib/store";
import { runScan } from "@/lib/pipeline/scan";
import { errorResponse } from "@/lib/api/respond";
import { rateLimit, clientIpFromHeaders } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST /api/projects/[id]/scan — "Scan Again" for an existing project. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ip = clientIpFromHeaders(req.headers);
  const rl = rateLimit(`scan:${ip}`, config.rateLimit.scanMax, config.rateLimit.scanWindowSeconds);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many scans. Please wait a moment.", code: "rate_limited" },
      { status: 429 },
    );
  }
  try {
    const store = getStore();
    const project = await store.getProjectById(params.id);
    if (!project) {
      return NextResponse.json({ error: "Project not found.", code: "not_found" }, { status: 404 });
    }
    const result = await runScan(project.x_username);
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
