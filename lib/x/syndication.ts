/**
 * Free, keyless single-tweet fetch via X's public syndication CDN — the same
 * endpoint the official embed widget (react-tweet) uses. No API key, no cost.
 *
 * Caveats (documented for honesty):
 *   - UNOFFICIAL and undocumented; X can change or block it at any time.
 *   - One tweet at a time (by status id) — it CANNOT list an account timeline.
 *   - Only works for public tweets.
 *
 * We use it only for the "paste a specific post URL" free flow. Everything is
 * treated as untrusted input and validated.
 */

import { XApiError, type XPost, type XUser } from "./client";

const BASE = "https://cdn.syndication.twimg.com/tweet-result";
const TIMEOUT_MS = 10_000;

/**
 * Token algorithm used by the syndication endpoint (base-36 of id*PI/1e15 with
 * zeros/dots stripped). Mirrors the public react-tweet implementation.
 */
function syndicationToken(id: string): string {
  return ((Number(id) / 1e15) * Math.PI)
    .toString(36)
    .replace(/(0+|\.)/g, "");
}

export interface SyndicationResult {
  user: XUser;
  post: XPost;
}

export async function fetchTweetBySyndication(postId: string): Promise<SyndicationResult> {
  if (!/^\d{1,25}$/.test(postId)) {
    throw new XApiError("not_found", "Invalid post id.");
  }

  const url = new URL(BASE);
  url.searchParams.set("id", postId);
  url.searchParams.set("token", syndicationToken(postId));
  url.searchParams.set("lang", "en");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
  } catch {
    throw new XApiError("unavailable", "Couldn't reach X to load that post.");
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 404) throw new XApiError("not_found", "That post was not found or is private.");
  if (!res.ok) throw new XApiError("unavailable", `Couldn't load that post (${res.status}).`);

  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new XApiError("unavailable", "Unexpected response loading that post.");
  }

  // A deleted/protected tweet returns a tombstone with no text.
  const text: string | undefined = data?.text;
  const u = data?.user;
  if (!text || !u?.screen_name) {
    throw new XApiError("not_found", "That post is unavailable (deleted or protected).");
  }

  const user: XUser = {
    id: u.id_str ?? `syndication_${u.screen_name}`,
    username: u.screen_name,
    name: u.name ?? u.screen_name,
    description: u.description ?? null,
    avatar_url: (u.profile_image_url_https ?? "").replace("_normal", "") || null,
    profile_url: `https://x.com/${u.screen_name}`,
  };

  const post: XPost = {
    id: data.id_str ?? postId,
    text,
    created_at: data.created_at ?? new Date().toISOString(),
    url: `https://x.com/${u.screen_name}/status/${data.id_str ?? postId}`,
  };

  return { user, post };
}
