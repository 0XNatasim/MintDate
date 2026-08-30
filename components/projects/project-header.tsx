import { Badge } from "@/components/ui/badge";
import { WatchButton } from "./watch-button";
import { ScanAgainButton } from "./scan-again-button";
import { timeAgo } from "@/lib/utils";
import type { Project } from "@/lib/types";

export function ProjectHeader({ project }: { project: Project }) {
  const initials = (project.name ?? project.x_username).slice(0, 2).toUpperCase();
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        {project.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.avatar_url}
            alt=""
            className="size-14 rounded-full border border-border object-cover"
          />
        ) : (
          <div className="grid size-14 place-items-center rounded-full border border-border bg-secondary text-lg font-semibold text-muted-foreground">
            {initials}
          </div>
        )}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">
              {project.name ?? project.x_username}
            </h1>
            {project.watching && <Badge variant="info">✓ Watching</Badge>}
          </div>
          <a
            href={project.profile_url ?? `https://x.com/${project.x_username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-primary"
          >
            @{project.x_username}
          </a>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Last checked {timeAgo(project.last_checked_at)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <WatchButton projectId={project.id} initialWatching={project.watching} />
        <ScanAgainButton projectId={project.id} />
      </div>
    </div>
  );
}
