/**
 * Presentation mappings for statuses. Kept framework-agnostic (no JSX) so both
 * server and client components can import it. Every status carries text + an
 * icon glyph so meaning is never conveyed by color alone (accessibility).
 */

import type {
  Confidence,
  OpportunityStatus,
  OpportunityType,
  VerificationStatus,
} from "@/lib/types";

type BadgeVariant = "default" | "outline" | "success" | "warning" | "danger" | "info";

export const STATUS_META: Record<
  OpportunityStatus,
  { label: string; glyph: string; variant: BadgeVariant; blurb: string }
> = {
  unknown: { label: "UNKNOWN", glyph: "○", variant: "outline", blurb: "No mint date announced" },
  rumored: { label: "RUMORED", glyph: "◐", variant: "warning", blurb: "Mint timing mentioned but not confirmed" },
  announced: { label: "ANNOUNCED", glyph: "●", variant: "info", blurb: "Mint information found on X" },
  verified: { label: "VERIFIED", glyph: "✓", variant: "success", blurb: "X + OpenSea agree" },
  live: { label: "LIVE", glyph: "◆", variant: "danger", blurb: "Mint appears active now" },
  ended: { label: "ENDED", glyph: "■", variant: "outline", blurb: "Mint window has ended" },
  cancelled: { label: "CANCELLED", glyph: "✕", variant: "outline", blurb: "Mint was cancelled" },
};

export const VERIFICATION_META: Record<
  VerificationStatus,
  { label: string; glyph: string; variant: BadgeVariant }
> = {
  unverified: { label: "Unverified", glyph: "○", variant: "outline" },
  x_only: { label: "X only", glyph: "𝕏", variant: "outline" },
  opensea_verified: { label: "OpenSea verified", glyph: "✓", variant: "success" },
  conflicting: { label: "Sources disagree", glyph: "⚠", variant: "warning" },
};

export const CONFIDENCE_META: Record<
  Confidence,
  { label: string; variant: BadgeVariant }
> = {
  high: { label: "HIGH", variant: "success" },
  medium: { label: "MEDIUM", variant: "warning" },
  low: { label: "LOW", variant: "outline" },
};

export const TYPE_LABEL: Record<OpportunityType, string> = {
  allowlist: "ALLOWLIST",
  presale: "PRESALE",
  public: "PUBLIC MINT",
  free: "FREE MINT",
  claim: "CLAIM",
  auction: "AUCTION",
  snapshot: "SNAPSHOT",
  registration: "REGISTRATION",
  unknown: "MINT",
};
