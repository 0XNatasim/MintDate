import { NextResponse } from "next/server";
import { getStore, ensureSeeded } from "@/lib/store";
import { recomputeStatuses } from "@/lib/pipeline/scan";
import { errorResponse } from "@/lib/api/respond";
import type { Opportunity } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/opportunities — flattened opportunities with a bit of project
 * context, sorted by soonest mint date. Powers the dashboard urgency sections.
 */
export async function GET() {
  try {
    await ensureSeeded();
    const store = getStore();
    const projects = await store.listProjectsWithOpportunities();
    const rows = projects.flatMap((p) =>
      recomputeStatuses(p.opportunities).map((o: Opportunity) => ({
        ...o,
        project: {
          id: p.id,
          x_username: p.x_username,
          name: p.name,
          avatar_url: p.avatar_url,
          watching: p.watching,
        },
      })),
    );
    rows.sort((a, b) => {
      if (a.mint_date && b.mint_date)
        return new Date(a.mint_date).getTime() - new Date(b.mint_date).getTime();
      if (a.mint_date) return -1;
      if (b.mint_date) return 1;
      return 0;
    });
    return NextResponse.json({ opportunities: rows });
  } catch (err) {
    return errorResponse(err);
  }
}
