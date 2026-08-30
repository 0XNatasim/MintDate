/**
 * Dashboard bucketing. Pure functions (no JSX) so they can run on the server
 * for the initial render and on the client for filter switches.
 */

import type { Opportunity } from "@/lib/types";

export interface ProjectRef {
  id: string;
  x_username: string;
  name: string | null;
  avatar_url: string | null;
  watching: boolean;
}

export interface OpportunityWithProject extends Opportunity {
  project: ProjectRef;
}

const HOUR = 3600_000;
const DAY = 24 * HOUR;

export type FilterKey =
  | "all"
  | "live"
  | "next24h"
  | "week"
  | "verified"
  | "unknown";

export function filterOpportunities(
  rows: OpportunityWithProject[],
  key: FilterKey,
  now = Date.now(),
): OpportunityWithProject[] {
  switch (key) {
    case "live":
      return rows.filter((r) => r.status === "live");
    case "next24h":
      return rows.filter(
        (r) => r.mint_date && withinAhead(r.mint_date, now, 0, DAY),
      );
    case "week":
      return rows.filter(
        (r) => r.mint_date && withinAhead(r.mint_date, now, 0, 7 * DAY),
      );
    case "verified":
      return rows.filter((r) => r.verification_status === "opensea_verified");
    case "unknown":
      return rows.filter((r) => !r.mint_date);
    case "all":
    default:
      return rows;
  }
}

function withinAhead(iso: string, now: number, fromMs: number, toMs: number): boolean {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  const delta = t - now;
  return delta >= fromMs && delta <= toMs;
}

export interface DashboardBuckets {
  mintingNow: OpportunityWithProject[];
  next24h: OpportunityWithProject[];
  next7d: OpportunityWithProject[];
  watchingUnknown: OpportunityWithProject[];
  recentlyVerified: OpportunityWithProject[];
  needsAttention: OpportunityWithProject[];
}

export function bucketDashboard(
  rows: OpportunityWithProject[],
  now = Date.now(),
): DashboardBuckets {
  const mintingNow = rows.filter((r) => r.status === "live");
  const upcoming = rows.filter(
    (r) => r.mint_date && new Date(r.mint_date).getTime() > now && r.status !== "live",
  );
  const next24h = upcoming.filter((r) => withinAhead(r.mint_date!, now, 0, DAY));
  const next7d = upcoming.filter(
    (r) => withinAhead(r.mint_date!, now, DAY, 7 * DAY),
  );
  const watchingUnknown = rows.filter(
    (r) => !r.mint_date && r.status !== "live" && r.status !== "ended",
  );
  const recentlyVerified = rows.filter(
    (r) => r.verification_status === "opensea_verified" && r.status !== "ended",
  );
  const needsAttention = rows.filter((r) => r.verification_status === "conflicting");

  return {
    mintingNow,
    next24h,
    next7d,
    watchingUnknown,
    recentlyVerified,
    needsAttention,
  };
}
