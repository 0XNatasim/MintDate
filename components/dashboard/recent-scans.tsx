import Link from "next/link";
import { Eye } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { timeAgo } from "@/lib/utils";
import { formatInZone } from "@/lib/dates/timezone";
import type { ProjectWithOpportunities } from "@/lib/types";

/** Compact "Recent Scans" rail on the dashboard. */
export function RecentScans({ projects }: { projects: ProjectWithOpportunities[] }) {
  if (projects.length === 0) return null;
  const recent = [...projects]
    .sort(
      (a, b) =>
        new Date(b.last_checked_at ?? b.updated_at).getTime() -
        new Date(a.last_checked_at ?? a.updated_at).getTime(),
    )
    .slice(0, 8);

  return (
    <Card className="p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
        Recent Scans
      </h2>
      <ul className="flex flex-col divide-y divide-border">
        {recent.map((p) => {
          const next = p.opportunities.find((o) => o.mint_date) ?? p.opportunities[0];
          return (
            <li key={p.id}>
              <Link
                href={`/project/${p.id}`}
                className="flex items-center justify-between gap-3 py-2.5 transition-colors hover:text-primary"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{p.name ?? `@${p.x_username}`}</span>
                    {p.watching && (
                      <Badge variant="info">
                        <Eye className="size-3" /> Watching
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Checked {timeAgo(p.last_checked_at)}
                  </span>
                </div>
                <span className="shrink-0 text-right text-xs text-muted-foreground tabular">
                  {next?.mint_date
                    ? formatInZone(next.mint_date, next.timezone)
                    : "Date unknown"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
