import { NextResponse } from "next/server";
import { getStore, ensureSeeded } from "@/lib/store";
import { recomputeStatuses } from "@/lib/pipeline/scan";
import { errorResponse } from "@/lib/api/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/projects — all projects with their opportunities (dashboard feed). */
export async function GET() {
  try {
    await ensureSeeded();
    const store = getStore();
    const projects = await store.listProjectsWithOpportunities();
    return NextResponse.json({
      projects: projects.map((p) => ({
        ...p,
        opportunities: recomputeStatuses(p.opportunities),
      })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
