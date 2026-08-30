import { ExternalLink, ShieldCheck } from "lucide-react";
import { displayHostname, isOpenSeaUrl } from "@/lib/security/url";
import { cn } from "@/lib/utils";

/**
 * Safe external link. Shows the destination hostname before the click (phishing
 * defense) and always opens with rel="noopener noreferrer". OpenSea links get a
 * distinct, trusted treatment; anything else is labeled an EXTERNAL MINT LINK.
 */
export function MintLink({
  url,
  kind,
  className,
}: {
  url: string;
  kind: "opensea" | "external";
  className?: string;
}) {
  const host = displayHostname(url);
  const opensea = kind === "opensea" && isOpenSeaUrl(url);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group inline-flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm transition-colors",
        opensea
          ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
          : "border-border bg-secondary/60 text-secondary-foreground hover:bg-secondary",
        className,
      )}
    >
      <span className="inline-flex items-center gap-2 font-medium">
        {opensea ? <ShieldCheck className="size-4" /> : <ExternalLink className="size-4" />}
        {opensea ? "OPEN OPENSEA" : "EXTERNAL MINT LINK"}
      </span>
      {host && <span className="truncate text-xs text-muted-foreground">{host}</span>}
    </a>
  );
}
