import { getStore, ensureSeeded } from "@/lib/store";
import { recomputeStatuses } from "@/lib/pipeline/scan";
import { ScannerForm } from "@/components/scanner/scanner-form";
import { OpportunityBoard } from "@/components/dashboard/opportunity-board";
import { RecentScans } from "@/components/dashboard/recent-scans";
import type { OpportunityWithProject } from "@/lib/display/buckets";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await ensureSeeded();
  const store = getStore();
  const projects = await store.listProjectsWithOpportunities();

  const rows: OpportunityWithProject[] = projects.flatMap((p) =>
    recomputeStatuses(p.opportunities).map((o) => ({
      ...o,
      project: {
        id: p.id,
        x_username: p.x_username,
        name: p.name,
        avatar_url: p.avatar_url,
        watching: p.watching,
      },
    })),
  );

  return (
    <div className="flex flex-col gap-10">
      {/* Hero */}
      <section className="mx-auto flex w-full max-w-3xl flex-col items-center gap-5 pt-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Don&apos;t miss another mint.
        </h1>
        <p className="max-w-xl text-balance text-muted-foreground">
          Paste an X account and MintDate finds the mint — date, time, price, chain and links,
          verified against OpenSea when possible.
        </p>
        <div className="w-full max-w-2xl">
          <ScannerForm autoFocus />
        </div>
      </section>

      {/* Dashboard */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <OpportunityBoard rows={rows} />
        <aside className="flex flex-col gap-6">
          <RecentScans projects={projects} />
        </aside>
      </div>
    </div>
  );
}
