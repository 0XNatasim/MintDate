/**
 * In-memory store. Backs mock mode, local dev without Supabase, and tests.
 * State lives in module globals so it survives across requests within a single
 * server process (it is intentionally NOT durable — that's what Supabase is
 * for). Uses globalThis so Next.js dev hot-reload doesn't wipe it each edit.
 */

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

interface MemoryDB {
  projects: Map<string, Project>;
  posts: Map<string, Post>; // key: x_post_id
  opportunities: Map<string, Opportunity>;
  scanRuns: Map<string, ScanRun>;
  seq: number;
}

const g = globalThis as unknown as { __mintdateDB?: MemoryDB };

function db(): MemoryDB {
  if (!g.__mintdateDB) {
    g.__mintdateDB = {
      projects: new Map(),
      posts: new Map(),
      opportunities: new Map(),
      scanRuns: new Map(),
      seq: 1,
    };
  }
  return g.__mintdateDB;
}

function id(prefix: string): string {
  const d = db();
  return `${prefix}_${(d.seq++).toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const nowIso = () => new Date().toISOString();

export class MemoryStore implements Store {
  readonly kind = "memory" as const;

  async getProjectById(pid: string): Promise<Project | null> {
    return db().projects.get(pid) ?? null;
  }

  async getProjectByUsername(username: string): Promise<Project | null> {
    const key = username.toLowerCase();
    for (const p of db().projects.values()) {
      if (p.x_username.toLowerCase() === key) return p;
    }
    return null;
  }

  async upsertProject(input: UpsertProjectInput): Promise<Project> {
    const existing = await this.getProjectByUsername(input.x_username);
    const t = nowIso();
    if (existing) {
      const updated: Project = {
        ...existing,
        x_user_id: input.x_user_id ?? existing.x_user_id,
        name: input.name ?? existing.name,
        description: input.description ?? existing.description,
        avatar_url: input.avatar_url ?? existing.avatar_url,
        profile_url: input.profile_url ?? existing.profile_url,
        updated_at: t,
      };
      db().projects.set(updated.id, updated);
      return updated;
    }
    const project: Project = {
      id: id("proj"),
      x_username: input.x_username,
      x_user_id: input.x_user_id,
      name: input.name,
      description: input.description,
      avatar_url: input.avatar_url,
      profile_url: input.profile_url,
      watching: false,
      last_tweet_id: null,
      last_checked_at: null,
      created_at: t,
      updated_at: t,
    };
    db().projects.set(project.id, project);
    return project;
  }

  async listProjects(): Promise<Project[]> {
    return [...db().projects.values()].sort(
      (a, b) =>
        new Date(b.last_checked_at ?? b.updated_at).getTime() -
        new Date(a.last_checked_at ?? a.updated_at).getTime(),
    );
  }

  async listWatchedProjects(): Promise<Project[]> {
    return (await this.listProjects()).filter((p) => p.watching);
  }

  async setWatching(projectId: string, watching: boolean): Promise<Project> {
    const p = db().projects.get(projectId);
    if (!p) throw new Error("Project not found");
    const updated = { ...p, watching, updated_at: nowIso() };
    db().projects.set(projectId, updated);
    return updated;
  }

  async updateScanState(
    projectId: string,
    fields: { last_tweet_id?: string | null; last_checked_at?: string },
  ): Promise<void> {
    const p = db().projects.get(projectId);
    if (!p) return;
    db().projects.set(projectId, {
      ...p,
      last_tweet_id:
        fields.last_tweet_id !== undefined ? fields.last_tweet_id : p.last_tweet_id,
      last_checked_at: fields.last_checked_at ?? p.last_checked_at,
      updated_at: nowIso(),
    });
  }

  async insertNewPosts(posts: NewPostInput[]): Promise<Post[]> {
    const inserted: Post[] = [];
    for (const input of posts) {
      if (db().posts.has(input.x_post_id)) continue;
      const post: Post = {
        id: id("post"),
        project_id: input.project_id,
        x_post_id: input.x_post_id,
        text: input.text,
        post_url: input.post_url,
        posted_at: input.posted_at,
        processed: false,
        created_at: nowIso(),
      };
      db().posts.set(input.x_post_id, post);
      inserted.push(post);
    }
    return inserted;
  }

  async markPostsProcessed(postIds: string[]): Promise<void> {
    const set = new Set(postIds);
    for (const post of db().posts.values()) {
      if (set.has(post.x_post_id) || set.has(post.id)) {
        db().posts.set(post.x_post_id, { ...post, processed: true });
      }
    }
  }

  async listRecentPosts(projectId: string, limit = 20): Promise<Post[]> {
    return [...db().posts.values()]
      .filter((p) => p.project_id === projectId)
      .sort((a, b) => new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime())
      .slice(0, limit);
  }

  async getOpportunitiesByProject(projectId: string): Promise<Opportunity[]> {
    return [...db().opportunities.values()]
      .filter((o) => o.project_id === projectId)
      .sort(byMintDate);
  }

  async upsertOpportunity(input: UpsertOpportunityInput): Promise<Opportunity> {
    const existing = (await this.getOpportunitiesByProject(input.project_id)).find(
      (o) => opportunitiesMatch(o, input),
    );
    const t = nowIso();
    if (existing) {
      const merged = mergeOpportunity(existing, input, t);
      db().opportunities.set(merged.id, merged);
      return merged;
    }
    const opp: Opportunity = {
      id: id("opp"),
      created_at: t,
      updated_at: t,
      ...input,
    };
    db().opportunities.set(opp.id, opp);
    return opp;
  }

  async listProjectsWithOpportunities(): Promise<ProjectWithOpportunities[]> {
    const projects = await this.listProjects();
    return Promise.all(
      projects.map(async (p) => ({
        ...p,
        opportunities: await this.getOpportunitiesByProject(p.id),
      })),
    );
  }

  async createScanRun(projectId: string): Promise<ScanRun> {
    const run: ScanRun = {
      id: id("scan"),
      project_id: projectId,
      started_at: nowIso(),
      completed_at: null,
      posts_fetched: 0,
      posts_processed: 0,
      opportunities_found: 0,
      status: "running",
      error_message: null,
    };
    db().scanRuns.set(run.id, run);
    return run;
  }

  async completeScanRun(
    runId: string,
    fields: Partial<ScanRun>,
  ): Promise<void> {
    const run = db().scanRuns.get(runId);
    if (!run) return;
    db().scanRuns.set(runId, { ...run, ...fields });
  }

  async latestScanRun(projectId: string): Promise<ScanRun | null> {
    return (
      [...db().scanRuns.values()]
        .filter((r) => r.project_id === projectId)
        .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())[0] ??
      null
    );
  }
}

function byMintDate(a: Opportunity, b: Opportunity): number {
  if (a.mint_date && b.mint_date)
    return new Date(a.mint_date).getTime() - new Date(b.mint_date).getTime();
  if (a.mint_date) return -1;
  if (b.mint_date) return 1;
  return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
}
