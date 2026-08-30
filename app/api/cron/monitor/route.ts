import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { getStore, ensureSeeded } from "@/lib/store";
import { runScan } from "@/lib/pipeline/scan";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// How many watched projects to process per invocation (bounds cost/time).
const BATCH = 10;
// Skip projects checked more recently than this (minutes).
const MIN_RECHECK_MINUTES = 15;

/**
 * Automated monitoring. Protected by CRON_SECRET so arbitrary callers cannot
 * trigger expensive scans. Vercel Cron sends the secret as a Bearer token
 * (Authorization header) automatically once configured.
 *
 * Processing:
 *   1. find watched projects, oldest-checked first
 *   2. fetch only posts newer than last_tweet_id (incremental)
 *   3. run mint detection, update opportunities, update last_checked_at
 */
async function handle(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized", code: "unauthorized" }, { status: 401 });
  }

  await ensureSeeded();
  const store = getStore();
  const watched = await store.listWatchedProjects();

  const now = Date.now();
  const due = watched
    .filter((p) => {
      if (!p.last_checked_at) return true;
      return now - new Date(p.last_checked_at).getTime() >= MIN_RECHECK_MINUTES * 60_000;
    })
    .slice(0, BATCH);

  const results: { username: string; opportunities: number; error?: string }[] = [];
  for (const project of due) {
    try {
      const res = await runScan(project.x_username, { incremental: true });
      results.push({ username: project.x_username, opportunities: res.opportunities.length });
    } catch (err) {
      logger.error("cron_scan_failed", { username: project.x_username, err });
      results.push({
        username: project.x_username,
        opportunities: 0,
        error: err instanceof Error ? err.message : "error",
      });
    }
  }

  logger.info("cron_monitor_complete", {
    watched: watched.length,
    processed: due.length,
  });

  return NextResponse.json({
    ok: true,
    watched: watched.length,
    processed: due.length,
    results,
  });
}

function isAuthorized(req: NextRequest): boolean {
  // In mock mode with no secret set (local dev) allow, so the endpoint is
  // testable. In production a secret is required.
  if (!config.cronSecret) return !config.isProd;
  const auth = req.headers.get("authorization");
  const headerSecret = req.headers.get("x-cron-secret");
  const url = new URL(req.url);
  const querySecret = url.searchParams.get("secret");
  return (
    auth === `Bearer ${config.cronSecret}` ||
    headerSecret === config.cronSecret ||
    querySecret === config.cronSecret
  );
}

export const GET = handle;
export const POST = handle;
