import Link from "next/link";
import { Coins, Layers, Boxes, MessageSquareQuote } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MintLink } from "./mint-link";
import { LocalTime } from "./local-time";
import { formatInZone } from "@/lib/dates/timezone";
import {
  STATUS_META,
  VERIFICATION_META,
  CONFIDENCE_META,
  TYPE_LABEL,
} from "@/lib/display/status";
import type { Opportunity } from "@/lib/types";

export interface OpportunityCardProps {
  opportunity: Opportunity;
  projectHref?: string;
  projectName?: string | null;
  username?: string | null;
  compact?: boolean;
}

export function OpportunityCard({
  opportunity: o,
  projectHref,
  projectName,
  username,
  compact,
}: OpportunityCardProps) {
  const status = STATUS_META[o.status];
  const verification = VERIFICATION_META[o.verification_status];
  const confidence = CONFIDENCE_META[o.confidence];
  const whenSource = o.mint_date ? formatInZone(o.mint_date, o.timezone) : null;
  const isConflicting = o.verification_status === "conflicting";

  return (
    <Card className="flex flex-col gap-4 p-5 animate-fade-in">
      {/* header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          {(projectName || username) && (
            <Link
              href={projectHref ?? "#"}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {projectName ?? `@${username}`}
            </Link>
          )}
          <span className="text-xs font-semibold tracking-widest text-primary">
            {TYPE_LABEL[o.type]}
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Badge variant={status.variant} title={status.blurb}>
            <span aria-hidden>{status.glyph}</span> {status.label}
          </Badge>
        </div>
      </div>

      {/* date */}
      <div>
        {whenSource ? (
          <div className="flex flex-col gap-0.5">
            <span className="text-2xl font-semibold tracking-tight tabular">{whenSource}</span>
            {o.mint_date && (
              <span className="text-xs text-muted-foreground">
                <LocalTime utcIso={o.mint_date} />
              </span>
            )}
          </div>
        ) : (
          <span className="text-lg font-medium text-muted-foreground">
            Date unknown — watching for updates
          </span>
        )}
      </div>

      {/* stats */}
      {(o.price != null || o.chain || o.supply) && (
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {o.price != null && (
            <span className="inline-flex items-center gap-1.5">
              <Coins className="size-4 text-muted-foreground" />
              <span className="tabular font-medium">
                {o.price === "0" ? "Free" : `${o.price}${o.currency ? ` ${o.currency}` : ""}`}
              </span>
            </span>
          )}
          {o.chain && (
            <span className="inline-flex items-center gap-1.5">
              <Layers className="size-4 text-muted-foreground" />
              <span className="font-medium">{o.chain}</span>
            </span>
          )}
          {o.supply && (
            <span className="inline-flex items-center gap-1.5">
              <Boxes className="size-4 text-muted-foreground" />
              <span className="tabular font-medium">{Number(o.supply).toLocaleString()} supply</span>
            </span>
          )}
        </div>
      )}

      {/* verification + confidence */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant={verification.variant}>
          <span aria-hidden>{verification.glyph}</span> {verification.label}
        </Badge>
        <Badge variant={confidence.variant} title="Extraction confidence">
          {confidence.label} confidence
        </Badge>
      </div>

      {isConflicting && (
        <p className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          ⚠ X and OpenSea disagree on this mint. Verify before acting.
        </p>
      )}

      {/* links */}
      {!compact && (o.opensea_url || o.mint_url) && (
        <div className="grid gap-2 sm:grid-cols-2">
          {o.opensea_url && <MintLink url={o.opensea_url} kind="opensea" />}
          {o.mint_url && <MintLink url={o.mint_url} kind="external" />}
        </div>
      )}

      {/* source */}
      {!compact && o.source_text && (
        <div className="rounded-md border border-border bg-background/40 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <MessageSquareQuote className="size-3.5" /> Source
          </div>
          <p className="line-clamp-3 text-sm text-foreground/80">&ldquo;{o.source_text}&rdquo;</p>
          {o.source_post_url && (
            <a
              href={o.source_post_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs text-primary hover:underline"
            >
              View X Post →
            </a>
          )}
        </div>
      )}
    </Card>
  );
}
