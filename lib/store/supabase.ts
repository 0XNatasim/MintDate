/**
 * Supabase-backed store. Mirrors the MemoryStore behaviour against Postgres.
 * All access uses the service-role client (server-only). Dedup for posts is
 * enforced by a UNIQUE(x_post_id) constraint plus a pre-filter; opportunity
 * merging reuses the shared merge helpers.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceClient } from "@/lib/supabase/client";
import type {
  Opportunity,
  Post,
  Project,
  ProjectWithOpportunities,
  ScanRun,
} from "@/lib/types";
import { mergeOpportunity, opportunitiesMatch } from "./merge";
import type {
  NewPostInput,
  Store,
  UpsertOpportunityInput,
  UpsertProjectInput,
} from "./types";

export class SupabaseStore implements Store {
  readonly kind = "supabase" as const;
  private db: SupabaseClient;

  constructor() {
    this.db = serviceClient();
  }

  async getProjectById(id: string): Promise<Project | null> {
    const { data } = await this.db.from("projects").select("*").eq("id", id).maybeSingle();
    return (data as Project) ?? null;
  }

  async getProjectByUsername(username: string): Promise<Project | null> {
    const { data } = await this.db
      .from("projects")
      .select("*")
      .ilike("x_username", username)
      .maybeSingle();
    return (data as Project) ?? null;
  }

  async upsertProject(input: UpsertProjectInput): Promise<Project> {
    const existing = await this.getProjectByUsername(input.x_username);
    if (existing) {
      const { data, error } = await this.db
        .from("projects")
        .update({
          x_user_id: input.x_user_id ?? existing.x_user_id,
          name: input.name ?? existing.name,
          description: input.description ?? existing.description,
          avatar_url: input.avatar_url ?? existing.avatar_url,
          profile_url: input.profile_url ?? existing.profile_url,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) throw error;
      return data as Project;
    }
    const { data, error } = await this.db
      .from("projects")
      .insert({
        x_username: input.x_username,
        x_user_id: input.x_user_id,
        name: input.name,
        description: input.description,
        avatar_url: input.avatar_url,
        profile_url: input.profile_url,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data as Project;
  }

  async listProjects(): Promise<Project[]> {
    const { data } = await this.db
      .from("projects")
      .select("*")
      .order("updated_at", { ascending: false });
    return (data as Project[]) ?? [];
  }

  async listWatchedProjects(): Promise<Project[]> {
    const { data } = await this.db
      .from("projects")
      .select("*")
      .eq("watching", true)
      .order("last_checked_at", { ascending: true, nullsFirst: true });
    return (data as Project[]) ?? [];
  }

  async setWatching(projectId: string, watching: boolean): Promise<Project> {
    const { data, error } = await this.db
      .from("projects")
      .update({ watching, updated_at: new Date().toISOString() })
      .eq("id", projectId)
      .select("*")
      .single();
    if (error) throw error;
    return data as Project;
  }

  async updateScanState(
    projectId: string,
    fields: { last_tweet_id?: string | null; last_checked_at?: string },
  ): Promise<void> {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (fields.last_tweet_id !== undefined) patch.last_tweet_id = fields.last_tweet_id;
    if (fields.last_checked_at !== undefined) patch.last_checked_at = fields.last_checked_at;
    await this.db.from("projects").update(patch).eq("id", projectId);
  }

  async insertNewPosts(posts: NewPostInput[]): Promise<Post[]> {
    if (posts.length === 0) return [];
    const ids = posts.map((p) => p.x_post_id);
    const { data: existing } = await this.db
      .from("posts")
      .select("x_post_id")
      .in("x_post_id", ids);
    const existingSet = new Set((existing ?? []).map((r: any) => r.x_post_id));
    const fresh = posts.filter((p) => !existingSet.has(p.x_post_id));
    if (fresh.length === 0) return [];
    const { data, error } = await this.db.from("posts").insert(fresh).select("*");
    if (error) throw error;
    return (data as Post[]) ?? [];
  }

  async markPostsProcessed(postIds: string[]): Promise<void> {
    if (postIds.length === 0) return;
    await this.db.from("posts").update({ processed: true }).in("x_post_id", postIds);
  }

  async listRecentPosts(projectId: string, limit = 20): Promise<Post[]> {
    const { data } = await this.db
      .from("posts")
      .select("*")
      .eq("project_id", projectId)
      .order("posted_at", { ascending: false })
      .limit(limit);
    return (data as Post[]) ?? [];
  }

  async getOpportunitiesByProject(projectId: string): Promise<Opportunity[]> {
    const { data } = await this.db
      .from("opportunities")
      .select("*")
      .eq("project_id", projectId)
      .order("mint_date", { ascending: true, nullsFirst: false });
    return (data as Opportunity[]) ?? [];
  }

  async upsertOpportunity(input: UpsertOpportunityInput): Promise<Opportunity> {
    const existing = (await this.getOpportunitiesByProject(input.project_id)).find((o) =>
      opportunitiesMatch(o, input),
    );
    if (existing) {
      const merged = mergeOpportunity(existing, input, new Date().toISOString());
      const { data, error } = await this.db
        .from("opportunities")
        .update({
          title: merged.title,
          mint_date: merged.mint_date,
          mint_end_date: merged.mint_end_date,
          timezone: merged.timezone,
          chain: merged.chain,
          price: merged.price,
          currency: merged.currency,
          supply: merged.supply,
          mint_url: merged.mint_url,
          opensea_url: merged.opensea_url,
          source_post_id: merged.source_post_id,
          source_post_url: merged.source_post_url,
          source_text: merged.source_text,
          confidence: merged.confidence,
          verification_status: merged.verification_status,
          status: merged.status,
          updated_at: merged.updated_at,
        })
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) throw error;
      return data as Opportunity;
    }
    const { data, error } = await this.db
      .from("opportunities")
      .insert(input)
      .select("*")
      .single();
    if (error) throw error;
    return data as Opportunity;
  }

  async listProjectsWithOpportunities(): Promise<ProjectWithOpportunities[]> {
    const { data } = await this.db
      .from("projects")
      .select("*, opportunities(*)")
      .order("updated_at", { ascending: false });
    return ((data as any[]) ?? []).map((p) => ({
      ...p,
      opportunities: (p.opportunities ?? []).sort((a: Opportunity, b: Opportunity) => {
        if (a.mint_date && b.mint_date)
          return new Date(a.mint_date).getTime() - new Date(b.mint_date).getTime();
        if (a.mint_date) return -1;
        if (b.mint_date) return 1;
        return 0;
      }),
    })) as ProjectWithOpportunities[];
  }

  async createScanRun(projectId: string): Promise<ScanRun> {
    const { data, error } = await this.db
      .from("project_scan_runs")
      .insert({ project_id: projectId, status: "running" })
      .select("*")
      .single();
    if (error) throw error;
    return data as ScanRun;
  }

  async completeScanRun(id: string, fields: Partial<ScanRun>): Promise<void> {
    await this.db.from("project_scan_runs").update(fields).eq("id", id);
  }

  async latestScanRun(projectId: string): Promise<ScanRun | null> {
    const { data } = await this.db
      .from("project_scan_runs")
      .select("*")
      .eq("project_id", projectId)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data as ScanRun) ?? null;
  }
}
