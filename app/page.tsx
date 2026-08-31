import { getStore, ensureSeeded } from "@/lib/store";
import { config } from "@/lib/config";
import { recomputeStatuses } from "@/lib/pipeline/scan";
import { ScannerForm } from "@/components/scanner/scanner-form";
import { PasteForm } from "@/components/scanner/paste-form";
import { OpportunityBoard } from "@/components/dashboard/opportunity-board";
import { RecentScans } from "@/components/dashboard/recent-scans";
import type { OpportunityWithProject } from "@/lib/display/buckets";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await ensureSeeded();
  const store = getStore();
  const projects = await store.listProjectsWithOpportunities();

  const canScanTimeline = config.x.enabled || config.mockMode;

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
        <div className="flex w-full max-w-2xl flex-col gap-3">
          <ScannerForm autoFocus canScanTimeline={canScanTimeline} />

          {!canScanTimeline && (
            <p className="text-xs text-muted-foreground">
              Free mode: paste a specific post URL above, or paste a post&apos;s text below.
              Scanning a whole account needs the X API.
            </p>
          )}

          <details className="group w-full text-left">
            <summary className="cursor-pointer list-none text-sm text-muted-foreground hover:text-foreground">
              <span className="underline underline-offset-4">Or paste a post&apos;s text</span>
              <span className="text-muted-foreground/60"> — no API key needed</span>
            </summary>
            <div className="mt-3">
              <PasteForm />
            </div>
          </details>
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
