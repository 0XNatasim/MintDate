import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { getStore, ensureSeeded } from "@/lib/store";
import { recomputeStatuses } from "@/lib/pipeline/scan";
import { ProjectHeader } from "@/components/projects/project-header";
import { OpportunityCard } from "@/components/opportunities/opportunity-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: { id: string } }) {
  await ensureSeeded();
  const store = getStore();
  const project = await store.getProjectById(params.id);
  if (!project) notFound();

  const [rawOpps, posts, scanRun] = await Promise.all([
    store.getOpportunitiesByProject(project.id),
    store.listRecentPosts(project.id, 25),
    store.latestScanRun(project.id),
  ]);
  const opportunities = recomputeStatuses(rawOpps);
  const [latest, ...rest] = opportunities;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Dashboard
      </Link>

      <ProjectHeader project={project} />

      {project.description && (
        <p className="max-w-2xl text-sm text-muted-foreground">{project.description}</p>
      )}

      {opportunities.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-lg font-medium">No mint announcement found.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            We&apos;ll keep watching @{project.x_username} for you. Try scanning again later.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Latest Opportunity
            </h2>
            <div className="grid gap-4 lg:grid-cols-2">
              <OpportunityCard
                opportunity={latest}
                projectName={project.name}
                username={project.x_username}
              />
            </div>
          </section>

          {rest.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                All Detected Opportunities ({opportunities.length})
              </h2>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {rest.map((o) => (
                  <OpportunityCard
                    key={o.id}
                    opportunity={o}
                    projectName={project.name}
                    username={project.x_username}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Recent posts */}
      {posts.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Recent Posts
          </h2>
          <Card className="divide-y divide-border">
            {posts.slice(0, 12).map((post) => (
              <a
                key={post.id}
                href={post.post_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col gap-1 p-4 transition-colors hover:bg-accent/40"
              >
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MessageSquare className="size-3.5" />
                  {timeAgo(post.posted_at)}
                  {post.processed && <Badge variant="outline">analyzed</Badge>}
                </div>
                <p className="line-clamp-2 text-sm text-foreground/90">{post.text}</p>
              </a>
            ))}
          </Card>
        </section>
      )}

      {/* Scan observability */}
      {scanRun && (
        <section className="text-xs text-muted-foreground">
          Last scan {timeAgo(scanRun.started_at)} · {scanRun.posts_fetched} posts fetched ·{" "}
          {scanRun.posts_processed} analyzed · {scanRun.opportunities_found} opportunities ·{" "}
          status {scanRun.status}
        </section>
      )}
    </div>
  );
}
