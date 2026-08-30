/**
 * Post helpers: pick the newest post id (used as `since_id` on the next scan
 * to fetch only new posts — a core cost control) and basic ordering.
 */

import type { XPost } from "./client";

/**
 * The id of the newest post, used as the next scan's `since_id` cursor. We pick
 * by timestamp (robust for both real snowflake ids and mock ids). This is the
 * core cost control — later scans fetch only posts newer than this.
 */
export function newestPostId(posts: { id: string; created_at: string }[]): string | null {
  if (posts.length === 0) return null;
  let newest = posts[0];
  for (const p of posts) {
    if (new Date(p.created_at).getTime() > new Date(newest.created_at).getTime()) {
      newest = p;
    }
  }
  return newest.id;
}

export function sortNewestFirst(posts: XPost[]): XPost[] {
  return [...posts].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}
