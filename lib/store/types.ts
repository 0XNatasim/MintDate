import type {
  Opportunity,
  Post,
  Project,
  ProjectWithOpportunities,
  ScanRun,
} from "@/lib/types";

export interface UpsertProjectInput {
  x_username: string;
  x_user_id: string | null;
  name: string | null;
  description: string | null;
  avatar_url: string | null;
  profile_url: string | null;
}

export interface NewPostInput {
  project_id: string;
  x_post_id: string;
  text: string;
  post_url: string;
  posted_at: string;
}

export interface UpsertOpportunityInput {
  project_id: string;
  type: Opportunity["type"];
  title: string | null;
  mint_date: string | null;
  mint_end_date: string | null;
  timezone: string | null;
  chain: string | null;
  price: string | null;
  currency: string | null;
  supply: string | null;
  mint_url: string | null;
  opensea_url: string | null;
  source_post_id: string | null;
  source_post_url: string | null;
  source_text: string | null;
  confidence: Opportunity["confidence"];
  verification_status: Opportunity["verification_status"];
  status: Opportunity["status"];
}

/**
 * Storage abstraction. Two implementations back it: an in-memory store (mock /
 * dev / tests) and a Supabase-backed store (production). The pipeline and API
 * layer depend only on this interface.
 */
export interface Store {
  readonly kind: "memory" | "supabase";

  getProjectById(id: string): Promise<Project | null>;
  getProjectByUsername(username: string): Promise<Project | null>;
  upsertProject(input: UpsertProjectInput): Promise<Project>;
  listProjects(): Promise<Project[]>;
  listWatchedProjects(): Promise<Project[]>;
  setWatching(projectId: string, watching: boolean): Promise<Project>;
  updateScanState(
    projectId: string,
    fields: { last_tweet_id?: string | null; last_checked_at?: string },
  ): Promise<void>;

  /** Insert posts, skipping any whose x_post_id already exists. Returns the
   * subset that were actually newly inserted. */
  insertNewPosts(posts: NewPostInput[]): Promise<Post[]>;
  markPostsProcessed(postIds: string[]): Promise<void>;
  listRecentPosts(projectId: string, limit?: number): Promise<Post[]>;

  getOpportunitiesByProject(projectId: string): Promise<Opportunity[]>;
  /** Insert or merge an opportunity (dedup by project+type+date bucket). */
  upsertOpportunity(input: UpsertOpportunityInput): Promise<Opportunity>;
  listProjectsWithOpportunities(): Promise<ProjectWithOpportunities[]>;

  createScanRun(projectId: string): Promise<ScanRun>;
  completeScanRun(
    id: string,
    fields: Partial<
      Pick<
        ScanRun,
        | "completed_at"
        | "posts_fetched"
        | "posts_processed"
        | "opportunities_found"
        | "status"
        | "error_message"
      >
    >,
  ): Promise<void>;
  latestScanRun(projectId: string): Promise<ScanRun | null>;
}
