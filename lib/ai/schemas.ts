import { z } from "zod";

/**
 * Strict structured-output schema for mint extraction. This is the ONLY shape
 * we accept back from the model — free-form prose is never parsed by hand.
 *
 * A note on nullable URL fields: we intentionally accept `string | null` here
 * (not `.url()`) because models occasionally emit partial URLs; we validate &
 * sanitize URLs downstream with the security helpers rather than rejecting the
 * whole extraction over one malformed field.
 */
export const MintOpportunitySchema = z.object({
  mintFound: z.boolean(),
  project: z.string().nullable(),
  opportunityType: z.enum([
    "allowlist",
    "presale",
    "public",
    "free",
    "claim",
    "auction",
    "snapshot",
    "registration",
    "unknown",
  ]),
  /** The raw human phrasing of the date, e.g. "September 4 at 1 PM ET". */
  mintDateText: z.string().nullable(),
  /** ISO-8601. Absolute (with Z/offset) or naive local. null if unknown. */
  mintDateIso: z.string().nullable(),
  mintEndDateIso: z.string().nullable(),
  /** IANA zone or common abbreviation (ET, PST, UTC...). null if absent. */
  timezone: z.string().nullable(),
  chain: z.string().nullable(),
  price: z.string().nullable(),
  currency: z.string().nullable(),
  supply: z.string().nullable(),
  officialMintUrl: z.string().nullable(),
  openSeaUrl: z.string().nullable(),
  confidence: z.enum(["high", "medium", "low"]),
  /** Short quote/justification for why a mint was detected. */
  evidence: z.string().nullable(),
});

export type MintExtraction = z.infer<typeof MintOpportunitySchema>;

/** JSON Schema handed to the OpenAI structured-output API. */
export const mintOpportunityJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    mintFound: { type: "boolean" },
    project: { type: ["string", "null"] },
    opportunityType: {
      type: "string",
      enum: [
        "allowlist",
        "presale",
        "public",
        "free",
        "claim",
        "auction",
        "snapshot",
        "registration",
        "unknown",
      ],
    },
    mintDateText: { type: ["string", "null"] },
    mintDateIso: { type: ["string", "null"] },
    mintEndDateIso: { type: ["string", "null"] },
    timezone: { type: ["string", "null"] },
    chain: { type: ["string", "null"] },
    price: { type: ["string", "null"] },
    currency: { type: ["string", "null"] },
    supply: { type: ["string", "null"] },
    officialMintUrl: { type: ["string", "null"] },
    openSeaUrl: { type: ["string", "null"] },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    evidence: { type: ["string", "null"] },
  },
  required: [
    "mintFound",
    "project",
    "opportunityType",
    "mintDateText",
    "mintDateIso",
    "mintEndDateIso",
    "timezone",
    "chain",
    "price",
    "currency",
    "supply",
    "officialMintUrl",
    "openSeaUrl",
    "confidence",
    "evidence",
  ],
} as const;
