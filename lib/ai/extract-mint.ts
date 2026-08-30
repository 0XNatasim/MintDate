/**
 * Structured mint extraction.
 *
 * Two backends:
 *   - Real: OpenAI structured outputs (JSON schema). Strict, no prose parsing.
 *   - Mock: a deterministic rule-based parser used when no OPENAI_API_KEY is
 *     configured or MINTDATE_MOCK_MODE=true. It never invents dates.
 *
 * Both return data validated against `MintOpportunitySchema`.
 */

import OpenAI from "openai";
import { config } from "@/lib/config";
import { logger } from "@/lib/logger";
import {
  MintOpportunitySchema,
  mintOpportunityJsonSchema,
  type MintExtraction,
} from "./schemas";

export interface ExtractContext {
  username: string;
  projectName?: string | null;
  postedAt?: string | null;
}

const SYSTEM_PROMPT = `You extract NFT mint opportunity data from a single X (Twitter) post.

CRITICAL RULES — follow exactly:
- NEVER GUESS. NEVER INVENT A DATE.
- NEVER infer a specific day from vague language ("soon", "this week") without a concrete date in the post. In those cases set mintDateIso = null and confidence = "low".
- If the post says "September 4": produce an ISO date. Use the year only when the surrounding context makes it clear; otherwise choose the next occurrence of that date at or after the post's date.
- If a timezone is absent, do NOT assume EST — set timezone = null.
- If the post links an external mint site, extract that EXACT url into officialMintUrl.
- If the post links opensea.io, put it in openSeaUrl.
- Only use information supported by THIS post and the provided account context.
- If there is no mint information at all, set mintFound = false and everything else to null/"unknown".

mintDateIso format: ISO-8601. If you know the exact timezone offset, include it; otherwise emit a naive local time (no offset) and put the zone name in "timezone".
confidence: "high" = explicit date/time/link; "medium" = clear mint info but incomplete; "low" = ambiguous or promotional.`;

function buildUserPrompt(text: string, ctx: ExtractContext): string {
  return [
    `Account: @${ctx.username}${ctx.projectName ? ` (${ctx.projectName})` : ""}`,
    ctx.postedAt ? `Post date (UTC): ${ctx.postedAt}` : null,
    "",
    "Post text:",
    '"""',
    text,
    '"""',
  ]
    .filter(Boolean)
    .join("\n");
}

let _client: OpenAI | null = null;
function openaiClient(): OpenAI {
  if (!_client) _client = new OpenAI({ apiKey: config.openai.apiKey });
  return _client;
}

export async function extractMintFromPost(
  text: string,
  ctx: ExtractContext,
): Promise<MintExtraction> {
  if (config.mockMode || !config.openai.enabled) {
    return mockExtract(text, ctx);
  }
  try {
    const completion = await openaiClient().chat.completions.create({
      model: config.openai.model,
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(text, ctx) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "mint_opportunity",
          strict: true,
          schema: mintOpportunityJsonSchema,
        },
      },
    });
    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error("Empty extraction response");
    const parsed = MintOpportunitySchema.parse(JSON.parse(raw));
    return parsed;
  } catch (err) {
    logger.error("openai_extraction_failed", { err, username: ctx.username });
    // Degrade gracefully to the rule-based parser rather than dropping the post.
    return mockExtract(text, ctx);
  }
}

// ── Deterministic rule-based parser (mock / fallback) ──────────────────────

const TYPE_PATTERNS: [MintExtraction["opportunityType"], RegExp][] = [
  ["allowlist", /\b(allow ?list|whitelist|\bwl\b)\b/i],
  ["presale", /\bpre[-\s]?sale\b/i],
  ["free", /\bfree\s+(mint|claim)\b/i],
  ["claim", /\bclaim\b/i],
  ["auction", /\bauction\b/i],
  ["snapshot", /\bsnapshot\b/i],
  ["registration", /\b(registration|register)\b/i],
  ["public", /\bpublic\s+(mint|sale)\b/i],
];

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function detectType(text: string): MintExtraction["opportunityType"] {
  for (const [type, re] of TYPE_PATTERNS) if (re.test(text)) return type;
  if (/\bmint(ing)?\b/i.test(text)) return "public";
  return "unknown";
}

function detectChain(text: string): string | null {
  if (/\beth(ereum)?\b/i.test(text)) return "Ethereum";
  if (/\b(sol|solana)\b/i.test(text)) return "Solana";
  if (/\b(mon|monad)\b/i.test(text)) return "Monad";
  if (/\bbase\b/i.test(text)) return "Base";
  if (/\b(matic|polygon)\b/i.test(text)) return "Polygon";
  if (/\b(arb|arbitrum)\b/i.test(text)) return "Arbitrum";
  return null;
}

function detectPrice(text: string): { price: string | null; currency: string | null } {
  if (/\bfree\b/i.test(text)) return { price: "0", currency: null };
  const m = text.match(/(\d+(?:\.\d+)?)\s*(eth|sol|mon|matic)\b/i);
  if (m) return { price: m[1], currency: m[2].toUpperCase() };
  return { price: null, currency: null };
}

function detectSupply(text: string): string | null {
  const m =
    text.match(/supply\s*(?:of|:)?\s*([\d,]{2,})/i) ||
    text.match(/\b([\d,]{3,})\s*(?:supply|pieces|nfts|editions)\b/i);
  if (m) return m[1].replace(/,/g, "");
  return null;
}

function detectUrls(text: string): { mint: string | null; opensea: string | null } {
  const urls = text.match(/https?:\/\/[^\s"')]+/gi) ?? [];
  let opensea: string | null = null;
  let mint: string | null = null;
  for (const u of urls) {
    if (/opensea\.io/i.test(u)) opensea = opensea ?? u;
    else mint = mint ?? u;
  }
  return { mint, opensea };
}

const TZ_RE =
  /\b(ET|EST|EDT|CT|CST|CDT|MT|MST|MDT|PT|PST|PDT|GMT|UTC|BST|CET|CEST|JST|KST|SGT|IST|AEST|AEDT)\b/;

/** Parse a "September 4[, 2026] [at] [1[:30]] [PM]" style date. Returns naive ISO. */
function detectDate(
  text: string,
  postedAt?: string | null,
): { iso: string | null; tz: string | null; dateText: string | null } {
  // Explicit ISO first.
  const isoMatch = text.match(
    /\b\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:?\d{2})?)?/,
  );
  const tzMatch = text.match(TZ_RE);
  const tz = tzMatch ? tzMatch[1] : null;

  if (isoMatch) {
    return { iso: isoMatch[0].replace(" ", "T"), tz, dateText: isoMatch[0] };
  }

  const monthRe =
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?/i;
  const m = text.match(monthRe);
  if (!m) return { iso: null, tz, dateText: null };

  const month = MONTHS[m[1].slice(0, 3).toLowerCase()];
  const day = parseInt(m[2], 10);
  let year = m[3] ? parseInt(m[3], 10) : undefined;

  // Time.
  const timeMatch = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?/i);
  let hour = 0;
  let minute = 0;
  if (timeMatch) {
    hour = parseInt(timeMatch[1], 10) % 12;
    if (/p/i.test(timeMatch[3])) hour += 12;
    minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
  }

  if (year === undefined) {
    // Use the next occurrence at/after the post date.
    const base = postedAt ? new Date(postedAt) : new Date();
    year = base.getUTCFullYear();
    const candidate = Date.UTC(year, month, day, hour, minute);
    if (candidate < base.getTime() - 86_400_000) year += 1;
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  const iso = `${year}-${pad(month + 1)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00`;
  return { iso, tz, dateText: m[0] + (timeMatch ? ` ${timeMatch[0]}` : "") };
}

export function mockExtract(text: string, ctx: ExtractContext): MintExtraction {
  const hasMintLang = /\b(mint|allowlist|whitelist|presale|claim|drop|snapshot|auction|goes live|public sale)\b/i.test(
    text,
  );
  const { iso, tz, dateText } = detectDate(text, ctx.postedAt ?? undefined);
  const type = detectType(text);
  const chain = detectChain(text);
  const { price, currency } = detectPrice(text);
  const supply = detectSupply(text);
  const { mint, opensea } = detectUrls(text);

  const mintFound = hasMintLang && (type !== "unknown" || iso !== null);
  if (!mintFound) {
    return {
      mintFound: false,
      project: ctx.projectName ?? null,
      opportunityType: "unknown",
      mintDateText: null,
      mintDateIso: null,
      mintEndDateIso: null,
      timezone: null,
      chain: null,
      price: null,
      currency: null,
      supply: null,
      officialMintUrl: null,
      openSeaUrl: null,
      confidence: "low",
      evidence: null,
    };
  }

  // Vague-time language with no concrete date -> null date, low confidence.
  const vague = /\b(soon|tba|this week|next week|coming|stay tuned)\b/i.test(text);
  const finalIso = iso ?? null;
  let confidence: MintExtraction["confidence"] = "low";
  if (finalIso && (mint || opensea)) confidence = "high";
  else if (finalIso) confidence = "medium";
  else if (!vague && (mint || opensea)) confidence = "medium";

  return {
    mintFound: true,
    project: ctx.projectName ?? null,
    opportunityType: type,
    mintDateText: dateText,
    mintDateIso: finalIso,
    mintEndDateIso: null,
    timezone: tz,
    chain,
    price,
    currency,
    supply,
    officialMintUrl: mint,
    openSeaUrl: opensea,
    confidence,
    evidence: hasMintLang ? text.slice(0, 180) : null,
  };
}
