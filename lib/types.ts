/**
 * Shared domain types. These mirror the Supabase schema (see
 * supabase/migrations) and are the contract between the pipeline, the API
 * routes and the UI.
 */

export type OpportunityType =
  | "allowlist"
  | "presale"
  | "public"
  | "free"
  | "claim"
  | "auction"
  | "snapshot"
  | "registration"
  | "unknown";

export type OpportunityStatus =
  | "unknown"
  | "rumored"
  | "announced"
  | "verified"
  | "live"
  | "ended"
  | "cancelled";

export type VerificationStatus =
  | "unverified"
  | "x_only"
  | "opensea_verified"
  | "conflicting";

export type Confidence = "high" | "medium" | "low";

export type ScanRunStatus = "running" | "completed" | "failed";

export interface Project {
  id: string;
  x_username: string;
  x_user_id: string | null;
  name: string | null;
  description: string | null;
  avatar_url: string | null;
  profile_url: string | null;
  watching: boolean;
  last_tweet_id: string | null;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Post {
  id: string;
  project_id: string;
  x_post_id: string;
  text: string;
  post_url: string;
  posted_at: string;
  processed: boolean;
  created_at: string;
}

export interface Opportunity {
  id: string;
  project_id: string;
  type: OpportunityType;
  title: string | null;
  mint_date: string | null; // UTC ISO timestamp
  mint_end_date: string | null; // UTC ISO timestamp
  timezone: string | null; // IANA zone the source expressed, e.g. America/New_York
  chain: string | null;
  price: string | null;
  currency: string | null;
  supply: string | null;
  mint_url: string | null;
  opensea_url: string | null;
  source_post_id: string | null;
  source_post_url: string | null;
  source_text: string | null;
  confidence: Confidence;
  verification_status: VerificationStatus;
  status: OpportunityStatus;
  created_at: string;
  updated_at: string;
}

export interface ScanRun {
  id: string;
  project_id: string;
  started_at: string;
  completed_at: string | null;
  posts_fetched: number;
  posts_processed: number;
  opportunities_found: number;
  status: ScanRunStatus;
  error_message: string | null;
}

/** A project bundled with its opportunities, used by the API + UI. */
export interface ProjectWithOpportunities extends Project {
  opportunities: Opportunity[];
}

export interface ScanResult {
  project: Project;
  opportunities: Opportunity[];
  scanRun: ScanRun;
  mockMode: boolean;
  message?: string;
}
