/**
 * The scan pipeline — the heart of MintDate.
 *
 *   normalize input → resolve X account → upsert project → fetch recent posts
 *   → dedupe → keyword filter → AI extraction → create/update opportunities
 *   → OpenSea verification → return project + opportunities
 *
 * Used by POST /api/scan (interactive) and /api/cron/monitor (incremental).
 */

import { config } from "@/lib/config";
import { logger } from "@/lib/logger";
import { getStore } from "@/lib/store";
import type { Opportunity, ScanResult } from "@/lib/types";
import { resolveUser, fetchRecentPosts, logXUsage } from "@/lib/x/client";
import { newestPostId, sortNewestFirst } from "@/lib/x/posts";
import { isPotentiallyRelevant } from "@/lib/ai/keywords";
import { extractMintFromPost } from "@/lib/ai/extract-mint";
import { normalizeMintDate, resolveTimezone } from "@/lib/dates/timezone";
import { verifyOpportunity } from "@/lib/opensea/drops";
import { deriveStatus } from "./status";
import { sanitizeExternalUrl, isOpenSeaUrl } from "@/lib/security/url";
import { findMockAccount } from "@/lib/mock/fixtures";

export interface ScanOptions {
  /** Incremental scan: only fetch posts newer than the stored last_tweet_id. */
  incremental?: boolean;
  maxPosts?: number;
}

let scanCounter = 0;

export async function runScan(
  username: string,
  opts: ScanOptions = {},
): Promise<ScanResult> {
  const scanId = `scan_${Date.now().toString(36)}_${(scanCounter++).toString(36)}`;
  const startedMs = Date.now();
  const store = getStore();

  // 1. Resolve X account.
  const user = await resolveUser(username);

  // 2. Upsert project.
  const project = await store.upsertProject({
    x_username: user.username,
    x_user_id: user.id,
    name: user.name,
    description: user.description,
    avatar_url: user.avatar_url,
    profile_url: user.profile_url,
  });

  const scanRun = await store.createScanRun(project.id);

  let postsFetched = 0;
  let postsProcessed = 0;
  let opportunitiesFound = 0;

  try {
    // 3. Fetch recent posts (incremental uses since_id for cost control).
    const sinceId = opts.incremental ? project.last_tweet_id : null;
    const rawPosts = await fetchRecentPosts(user, {
      sinceId,
      max: opts.maxPosts ?? 30,
    });
    postsFetched = rawPosts.length;
    logXUsage({ scanId, xUsername: user.username, postsFetched, incremental: !!sinceId });

    // 4. Deduplicate + persist new posts.
    const newPosts = await store.insertNewPosts(
      rawPosts.map((p) => ({
        project_id: project.id,
        x_post_id: p.id,
        text: p.text,
        post_url: p.url,
        posted_at: p.created_at,
      })),
    );

    const openseaSlugHint = findMockAccount(user.username)?.openseaSlug ?? null;
    const processedIds: string[] = [];

    // 5. Keyword filter → 6. AI extraction → 7. persist opportunities.
    for (const post of sortNewestFirst(
      newPosts.map((p) => ({
        id: p.x_post_id,
        text: p.text,
        created_at: p.posted_at,
        url: p.post_url,
      })),
    )) {
      processedIds.push(post.id);
      const relevance = isPotentiallyRelevant(post.text);
      if (!relevance.relevant) continue;
      postsProcessed++;

      const extraction = await extractMintFromPost(post.text, {
        username: user.username,
        projectName: project.name,
        postedAt: post.created_at,
      });
      if (!extraction.mintFound) continue;

      const normalized = normalizeMintDate(extraction.mintDateIso, extraction.timezone);
      const normalizedEnd = normalizeMintDate(extraction.mintEndDateIso, extraction.timezone);
      const mintUrl = sanitizeExternalUrl(extraction.officialMintUrl);
      let openseaUrl = sanitizeExternalUrl(extraction.openSeaUrl);
      if (openseaUrl && !isOpenSeaUrl(openseaUrl)) openseaUrl = null;

      // 8. OpenSea verification (compare, never overwrite).
      const verification = await verifyOpportunity({
        mint_date: normalized?.utc ?? null,
        opensea_url: openseaUrl,
        price: extraction.price,
        currency: extraction.currency,
        supply: extraction.supply,
        openseaSlugHint,
      });

      if (!openseaUrl && verification.collection?.url) {
        openseaUrl = verification.collection.url;
      }

      const status = deriveStatus({
        mint_date: normalized?.utc ?? null,
        mint_end_date: normalizedEnd?.utc ?? null,
        verification_status: verification.status,
        hasMintInfo: true,
      });

      await store.upsertOpportunity({
        project_id: project.id,
        type: extraction.opportunityType,
        title: extraction.project ?? project.name,
        mint_date: normalized?.utc ?? null,
        mint_end_date: normalizedEnd?.utc ?? null,
        timezone: normalized?.timezone ?? resolveTimezone(extraction.timezone),
        chain: extraction.chain,
        price: extraction.price,
        currency: extraction.currency,
        supply: extraction.supply,
        mint_url: mintUrl,
        opensea_url: openseaUrl,
        source_post_id: post.id,
        source_post_url: post.url,
        source_text: post.text,
        confidence: extraction.confidence,
        verification_status: verification.status,
        status,
      });
      opportunitiesFound++;
    }

    await store.markPostsProcessed(processedIds);

    // 9. Update incremental cursor + checked timestamp.
    const newest = newestPostId(rawPosts);
    await store.updateScanState(project.id, {
      last_tweet_id: newest ?? project.last_tweet_id,
      last_checked_at: new Date().toISOString(),
    });

    await store.completeScanRun(scanRun.id, {
      completed_at: new Date().toISOString(),
      posts_fetched: postsFetched,
      posts_processed: postsProcessed,
      opportunities_found: opportunitiesFound,
      status: "completed",
    });

    const freshProject = (await store.getProjectById(project.id)) ?? project;
    const opportunities = recomputeStatuses(
      await store.getOpportunitiesByProject(project.id),
    );

    logger.info("scan_complete", {
      scanId,
      projectId: project.id,
      xUsername: user.username,
      postsFetched,
      postsAnalyzed: postsProcessed,
      opportunitiesDetected: opportunitiesFound,
      durationMs: Date.now() - startedMs,
    });

    return {
      project: freshProject,
      opportunities,
      scanRun: (await store.latestScanRun(project.id)) ?? scanRun,
      mockMode: config.mockMode,
      message:
        opportunities.length === 0
          ? `No mint announcement found yet. We'll keep watching @${user.username}.`
          : undefined,
    };
  } catch (err) {
    logger.error("scan_failed", { scanId, xUsername: username, err });
    await store.completeScanRun(scanRun.id, {
      completed_at: new Date().toISOString(),
      posts_fetched: postsFetched,
      posts_processed: postsProcessed,
      opportunities_found: opportunitiesFound,
      status: "failed",
      error_message: err instanceof Error ? err.message : "unknown error",
    });
    throw err;
  }
}

/** Recompute time-sensitive statuses on read so "live"/"ended" stay current. */
export function recomputeStatuses(opps: Opportunity[]): Opportunity[] {
  return opps.map((o) => ({
    ...o,
    status:
      o.status === "cancelled"
        ? o.status
        : deriveStatus({
            mint_date: o.mint_date,
            mint_end_date: o.mint_end_date,
            verification_status: o.verification_status,
            hasMintInfo: true,
          }),
  }));
}
