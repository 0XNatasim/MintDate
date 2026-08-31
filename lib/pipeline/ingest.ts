/**
 * Free ingest paths that do NOT use the paid X API:
 *   - ingestManualText: the user pastes a post's text directly.
 *   - ingestFromSyndication: fetch ONE public tweet by URL via X's keyless
 *     syndication CDN.
 *
 * Both reuse the same per-post pipeline as a timeline scan (keyword filter →
 * extraction → OpenSea verification → persist), so results are identical in
 * shape and quality — only the source of the post text differs.
 */

import { config } from "@/lib/config";
import { logger } from "@/lib/logger";
import { getStore } from "@/lib/store";
import type { ScanResult } from "@/lib/types";
import { processPost, recomputeStatuses } from "./scan";
import { findMockAccount } from "@/lib/mock/fixtures";
import { fetchTweetBySyndication } from "@/lib/x/syndication";
import { sanitizeExternalUrl } from "@/lib/security/url";

interface ProjectSource {
  id: string | null;
  username: string;
  name: string | null;
  description: string | null;
  avatar_url: string | null;
  profile_url: string | null;
}

function simpleHash(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (Math.imul(31, h) + input.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

async function ingest(
  userLike: ProjectSource,
  post: { id: string; text: string; created_at: string; url: string },
): Promise<ScanResult> {
  const store = getStore();
  const project = await store.upsertProject({
    x_username: userLike.username,
    x_user_id: userLike.id,
    name: userLike.name,
    description: userLike.description,
    avatar_url: userLike.avatar_url,
    profile_url: userLike.profile_url,
  });

  const scanRun = await store.createScanRun(project.id);
  try {
    // Persist the post (deduped by id). We re-run extraction regardless, so
    // re-pasting an updated post refreshes the opportunity via merge logic.
    await store.insertNewPosts([
      {
        project_id: project.id,
        x_post_id: post.id,
        text: post.text,
        post_url: post.url,
        posted_at: post.created_at,
      },
    ]);

    const slugHint = findMockAccount(project.x_username)?.openseaSlug ?? null;
    const outcome = await processPost(project, post, slugHint);
    const analyzed = outcome.analyzed ? 1 : 0;
    const opportunitiesFound = outcome.opportunityCreated ? 1 : 0;
    await store.markPostsProcessed([post.id]);

    await store.updateScanState(project.id, { last_checked_at: new Date().toISOString() });
    await store.completeScanRun(scanRun.id, {
      completed_at: new Date().toISOString(),
      posts_fetched: 1,
      posts_processed: analyzed,
      opportunities_found: opportunitiesFound,
      status: "completed",
    });

    const freshProject = (await store.getProjectById(project.id)) ?? project;
    const opportunities = recomputeStatuses(await store.getOpportunitiesByProject(project.id));

    logger.info("ingest_complete", {
      projectId: project.id,
      xUsername: project.x_username,
      analyzed,
      opportunitiesDetected: opportunitiesFound,
    });

    return {
      project: freshProject,
      opportunities,
      scanRun: (await store.latestScanRun(project.id)) ?? scanRun,
      mockMode: config.mockMode,
      message:
        outcome.opportunityCreated
          ? undefined
          : "No mint details found in that post. Nothing was invented.",
    };
  } catch (err) {
    await store.completeScanRun(scanRun.id, {
      completed_at: new Date().toISOString(),
      status: "failed",
      error_message: err instanceof Error ? err.message : "unknown error",
    });
    throw err;
  }
}

/** Free: run extraction on a post's text the user pasted. */
export async function ingestManualText(input: {
  text: string;
  username?: string | null;
  postUrl?: string | null;
}): Promise<ScanResult> {
  const text = input.text.trim();
  const username = input.username?.trim() || "pasted";
  const isRealHandle = username !== "pasted";
  const postUrl = sanitizeExternalUrl(input.postUrl) ?? "";

  return ingest(
    {
      id: null,
      username,
      name: isRealHandle ? username : "Pasted Posts",
      description: isRealHandle ? null : "Opportunities from posts you pasted in.",
      avatar_url: null,
      profile_url: isRealHandle ? `https://x.com/${username}` : null,
    },
    {
      id: `paste_${simpleHash(text)}`,
      text,
      created_at: new Date().toISOString(),
      url: postUrl,
    },
  );
}

/** Free: fetch ONE tweet by id from the public syndication CDN, then extract. */
export async function ingestFromSyndication(postId: string): Promise<ScanResult> {
  const { user, post } = await fetchTweetBySyndication(postId);
  return ingest(
    {
      id: user.id,
      username: user.username,
      name: user.name,
      description: user.description,
      avatar_url: user.avatar_url,
      profile_url: user.profile_url,
    },
    post,
  );
}
