import { NextResponse } from "next/server";
import { getStore, ensureSeeded } from "@/lib/store";
import { recomputeStatuses } from "@/lib/pipeline/scan";
import { errorResponse } from "@/lib/api/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/projects/[id] — full project detail: opportunities, posts, scan. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await ensureSeeded();
    const store = getStore();
    const project = await store.getProjectById(params.id);
    if (!project) {
      return NextResponse.json({ error: "Project not found.", code: "not_found" }, { status: 404 });
    }
    const [opportunities, posts, scanRun] = await Promise.all([
      store.getOpportunitiesByProject(project.id),
      store.listRecentPosts(project.id, 25),
      store.latestScanRun(project.id),
    ]);
    return NextResponse.json({
      project,
      opportunities: recomputeStatuses(opportunities),
      posts,
      scanRun,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
