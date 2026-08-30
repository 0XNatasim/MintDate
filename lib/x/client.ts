/**
 * X (Twitter) API v2 wrapper. Real path uses the app-only Bearer token; mock
 * path serves fixtures. All network calls have a timeout and typed errors so
 * the API layer can present clean, distinct error states.
 */

import { config } from "@/lib/config";
import { logger } from "@/lib/logger";
import { findMockAccount } from "@/lib/mock/fixtures";

export interface XUser {
  id: string;
  username: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  profile_url: string;
}

export interface XPost {
  id: string;
  text: string;
  created_at: string; // ISO
  url: string;
}

export type XErrorKind =
  | "not_found"
  | "protected"
  | "rate_limited"
  | "unauthorized"
  | "unavailable"
  | "unknown";

export class XApiError extends Error {
  kind: XErrorKind;
  constructor(kind: XErrorKind, message: string) {
    super(message);
    this.name = "XApiError";
    this.kind = kind;
  }
}

const API_BASE = "https://api.twitter.com/2";
const TIMEOUT_MS = 12_000;

// Simple in-memory cache for username->user lookups (cost control).
const userCache = new Map<string, { user: XUser; at: number }>();
const USER_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

async function xFetch(path: string, params: Record<string, string>): Promise<any> {
  const url = new URL(`${API_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${config.x.bearerToken}` },
      signal: controller.signal,
    });
  } catch (err) {
    throw new XApiError("unavailable", "X API is unreachable.");
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 429) throw new XApiError("rate_limited", "X API rate limit reached.");
  if (res.status === 401 || res.status === 403)
    throw new XApiError("unauthorized", "X API credentials are invalid.");
  if (res.status === 404) throw new XApiError("not_found", "That X account was not found.");
  if (!res.ok) throw new XApiError("unavailable", `X API error (${res.status}).`);

  return res.json();
}

function mockUser(username: string): XUser {
  const acct = findMockAccount(username);
  if (!acct) {
    throw new XApiError("not_found", `@${username} was not found in mock fixtures.`);
  }
  return {
    id: acct.x_user_id,
    username: acct.username,
    name: acct.name,
    description: acct.description,
    avatar_url: null,
    profile_url: `https://x.com/${acct.username}`,
  };
}

export async function resolveUser(username: string): Promise<XUser> {
  const cacheKey = username.toLowerCase();
  const cached = userCache.get(cacheKey);
  if (cached && Date.now() - cached.at < USER_CACHE_TTL) return cached.user;

  let user: XUser;
  if (config.mockMode || !config.x.enabled) {
    user = mockUser(username);
  } else {
    const data = await xFetch(`/users/by/username/${encodeURIComponent(username)}`, {
      "user.fields": "description,profile_image_url,protected,name,username",
    });
    if (data.errors?.length && !data.data) {
      throw new XApiError("not_found", "That X account was not found.");
    }
    const u = data.data;
    if (u.protected) throw new XApiError("protected", "That X account is protected.");
    user = {
      id: u.id,
      username: u.username,
      name: u.name,
      description: u.description ?? null,
      avatar_url: u.profile_image_url?.replace("_normal", "") ?? null,
      profile_url: `https://x.com/${u.username}`,
    };
  }
  userCache.set(cacheKey, { user, at: Date.now() });
  return user;
}

export interface FetchPostsOptions {
  sinceId?: string | null;
  max?: number;
}

export async function fetchRecentPosts(
  user: XUser,
  opts: FetchPostsOptions = {},
): Promise<XPost[]> {
  const max = Math.min(Math.max(opts.max ?? 30, 5), 100);

  if (config.mockMode || !config.x.enabled) {
    const acct = findMockAccount(user.username);
    if (!acct) return [];
    let posts: XPost[] = acct.posts.map((p) => ({
      id: p.x_post_id,
      text: p.text,
      created_at: new Date(Date.now() + p.daysFromNow * 86_400_000).toISOString(),
      url: `https://x.com/${acct.username}/status/${p.x_post_id}`,
    }));
    if (opts.sinceId) {
      const idx = posts.findIndex((p) => p.id === opts.sinceId);
      if (idx !== -1) posts = posts.slice(0, idx);
    }
    return posts.slice(0, max);
  }

  const params: Record<string, string> = {
    max_results: String(Math.min(max, 100)),
    "tweet.fields": "created_at,text",
    exclude: "retweets,replies",
  };
  if (opts.sinceId) params.since_id = opts.sinceId;

  const data = await xFetch(`/users/${user.id}/tweets`, params);
  if (!data.data) return [];
  return (data.data as any[]).map((t) => ({
    id: t.id,
    text: t.text,
    created_at: t.created_at,
    url: `https://x.com/${user.username}/status/${t.id}`,
  }));
}

export function logXUsage(meta: Record<string, unknown>): void {
  logger.info("x_api_usage", meta);
}
