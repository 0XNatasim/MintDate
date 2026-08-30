/**
 * Post helpers: pick the newest post id (used as `since_id` on the next scan
 * to fetch only new posts — a core cost control) and basic ordering.
 */

import type { XPost } from "./client";

/** X post ids are numeric snowflakes; compare as BigInt when possible. */
export function newestPostId(posts: { id: string }[]): string | null {
  if (posts.length === 0) return null;
  let newest = posts[0].id;
  for (const p of posts) {
    try {
      if (BigInt(p.id) > BigInt(newest)) newest = p.id;
    } catch {
      // Non-numeric (mock) ids: fall back to lexical max.
      if (p.id > newest) newest = p.id;
    }
  }
  return newest;
}

export function sortNewestFirst(posts: XPost[]): XPost[] {
  return [...posts].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}
