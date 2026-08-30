/**
 * Cheap pre-LLM relevance filter. Only posts that pass this filter are sent to
 * the (expensive) structured extractor, which keeps OpenAI costs down. The
 * filter is intentionally lenient: false positives are cheap (one extra LLM
 * call that returns mintFound=false), false negatives mean a missed mint.
 */

const KEYWORDS = [
  "mint",
  "minting",
  "mint live",
  "public mint",
  "presale",
  "pre-sale",
  "pre sale",
  "allowlist",
  "allow list",
  "whitelist",
  "wl",
  "free mint",
  "free claim",
  "claim",
  "snapshot",
  "registration",
  "register",
  "fcfs",
  "drop",
  "launch",
  "sale",
  "auction",
  "reveal",
  "opensea",
  "magic eden",
  "magiceden",
  "foundation",
  "manifold",
  "zora",
  "mint date",
  "mint time",
  "supply",
  "gm mint",
  "goes live",
] as const;

// Chain / currency tickers that, combined with mint language, are strong hints.
const TICKERS = ["eth", "mon", "sol", "matic", "arb", "base"];

// Build word-boundary regexes once. Escape any regex-special chars.
const KEYWORD_RES = KEYWORDS.map(
  (k) => new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"),
);
const TICKER_RES = TICKERS.map((t) => new RegExp(`\\b${t}\\b`, "i"));

export interface RelevanceResult {
  relevant: boolean;
  matched: string[];
}

export function isPotentiallyRelevant(text: string): RelevanceResult {
  if (!text) return { relevant: false, matched: [] };
  const matched: string[] = [];
  for (let i = 0; i < KEYWORD_RES.length; i++) {
    if (KEYWORD_RES[i].test(text)) matched.push(KEYWORDS[i]);
  }
  // Tickers only count when there's also date/number context, to avoid every
  // "gm eth" tweet. Cheap heuristic: a ticker + a digit.
  if (matched.length === 0 && /\d/.test(text)) {
    for (let i = 0; i < TICKER_RES.length; i++) {
      if (TICKER_RES[i].test(text)) {
        matched.push(TICKERS[i]);
        break;
      }
    }
  }
  return { relevant: matched.length > 0, matched };
}
