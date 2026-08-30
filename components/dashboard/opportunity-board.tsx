"use client";

import { useMemo, useState } from "react";
import { Flame, Clock, CalendarDays, Eye, CheckCircle2, AlertTriangle } from "lucide-react";
import { OpportunityCard } from "@/components/opportunities/opportunity-card";
import { cn } from "@/lib/utils";
import {
  bucketDashboard,
  filterOpportunities,
  type FilterKey,
  type OpportunityWithProject,
} from "@/lib/display/buckets";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "live", label: "Live" },
  { key: "next24h", label: "Next 24h" },
  { key: "week", label: "This Week" },
  { key: "verified", label: "Verified" },
  { key: "unknown", label: "Unknown Date" },
];

export function OpportunityBoard({ rows }: { rows: OpportunityWithProject[] }) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const buckets = useMemo(() => bucketDashboard(rows), [rows]);
  const filtered = useMemo(() => filterOpportunities(rows, filter), [rows, filter]);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Filter opportunities">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            role="tab"
            aria-selected={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              filter === f.key
                ? "border-primary bg-primary/15 text-primary"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {rows.length === 0 && (
        <EmptyBoard />
      )}

      {rows.length > 0 && filter === "all" ? (
        <div className="flex flex-col gap-8">
          <Bucket icon={<Flame className="size-4 text-danger" />} title="Minting Now" rows={buckets.mintingNow} />
          <Bucket icon={<Clock className="size-4 text-warning" />} title="Next 24 Hours" rows={buckets.next24h} />
          <Bucket icon={<CalendarDays className="size-4 text-primary" />} title="Next 7 Days" rows={buckets.next7d} />
          <Bucket icon={<AlertTriangle className="size-4 text-warning" />} title="Needs Attention" rows={buckets.needsAttention} />
          <Bucket icon={<CheckCircle2 className="size-4 text-success" />} title="Recently Verified" rows={buckets.recentlyVerified} />
          <Bucket icon={<Eye className="size-4 text-muted-foreground" />} title="Watching / Date Unknown" rows={buckets.watchingUnknown} />
        </div>
      ) : rows.length > 0 ? (
        <Grid rows={filtered} emptyLabel="Nothing matches this filter yet." />
      ) : null}
    </section>
  );
}

function Bucket({
  icon,
  title,
  rows,
}: {
  icon: React.ReactNode;
  title: string;
  rows: OpportunityWithProject[];
}) {
  if (rows.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
        {icon} {title}
        <span className="tabular text-xs font-normal text-muted-foreground/70">({rows.length})</span>
      </h2>
      <Grid rows={rows} />
    </div>
  );
}

function Grid({ rows, emptyLabel }: { rows: OpportunityWithProject[]; emptyLabel?: string }) {
  if (rows.length === 0) {
    return emptyLabel ? (
      <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </p>
    ) : null;
  }
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {rows.map((o) => (
        <OpportunityCard
          key={o.id}
          opportunity={o}
          projectHref={`/project/${o.project.id}`}
          projectName={o.project.name}
          username={o.project.x_username}
        />
      ))}
    </div>
  );
}

function EmptyBoard() {
  return (
    <div className="rounded-xl border border-dashed border-border p-10 text-center">
      <p className="text-lg font-medium">No projects yet.</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Paste an X account above to find and track your first mint.
      </p>
    </div>
  );
}
