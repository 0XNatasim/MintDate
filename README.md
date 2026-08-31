# MintDate

**Don't miss another mint.** Paste an X (Twitter) account and MintDate finds the
mint — date, time, price, chain, supply and links — and verifies it against
OpenSea when possible. Save the project, watch it, and MintDate keeps checking
for new announcements so you never miss a drop.

> MintDate never invents a mint date. Unknown data stays unknown.

---

## What it does

```
SEE NFT PROJECT ON X → COPY @ACCOUNT → PASTE INTO MINTDATE → SCAN
      → DETECT MINT → VERIFY WITH OPENSEA → WATCH
      → AUTOMATICALLY CHECK NEW POSTS → DON'T MISS THE MINT
```

1. Resolve an X account from `@handle`, a bare handle, or an `x.com` / post URL.
2. Fetch recent original posts (incrementally on later scans — cost control).
3. Cheap keyword filter → structured AI extraction of mint details.
4. Normalize dates to UTC (DST-aware) while preserving the source timezone.
5. Cross-reference OpenSea: **verified**, **conflicting**, or **X-only**.
6. Watch the account; a cron job re-scans for new posts and updates opportunities.

## Architecture

- **Next.js 14 (App Router) + TypeScript + Tailwind** — server components for
  data, small client islands for interactivity (scan form, watch toggle, filters).
- **Pipeline** (`lib/pipeline/scan.ts`) orchestrates: normalize → resolve →
  upsert → fetch → dedupe → filter → extract → persist/merge → verify.
- **Storage abstraction** (`lib/store`) with two implementations behind one
  interface: `SupabaseStore` (production) and `MemoryStore` (mock/dev/tests).
- **Providers** are isolated in `lib/x`, `lib/ai`, `lib/opensea`, each with a
  real implementation and a mock path selected by `config.mockMode`.
- **Zod** validates AI output; **date-fns-tz** handles timezones.

```
app/            App Router pages + API routes (scan, projects, cron, health)
components/     ui primitives, scanner, dashboard, opportunities, projects
lib/            x/  ai/  opensea/  dates/  store/  security/  display/  pipeline/
supabase/       SQL migrations (schema + RLS)
```

## Requirements

- Node.js 20+ (built and tested on Node 22)
- npm
- (Production) a Supabase project, X API bearer token, OpenAI key, OpenSea key

## Local setup

```bash
npm install
cp .env.example .env.local   # leave as-is to run in mock mode
npm run dev                  # http://localhost:3000
```

With **no credentials**, the app runs in **mock mode**: realistic fixtures
(`@ExampleNFT`, `@FutureMint`, `@NoDateProject`, `@ConflictNFT`) exercise every
UI state (verified, conflicting, unknown, live). A **MOCK MODE** badge is shown
and `/api/health` reports it.

### Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Apply migrations (either option):
   - **CLI:** `supabase link --project-ref <ref>` then `supabase db push`
   - **Dashboard:** paste `supabase/migrations/0001_init.sql` then
     `0002_rls.sql` into the SQL editor and run them.
3. Copy the project URL + anon key + **service role** key into `.env.local`.

The service-role key is used **server-side only**. RLS is enabled on all tables
so the anon key cannot read/write directly.

### X API setup

Create a project/app in the [X Developer Portal](https://developer.x.com) and
copy an **app-only Bearer token** into `X_BEARER_TOKEN`. The app uses:
`GET /2/users/by/username/:name` and `GET /2/users/:id/tweets` with
`since_id` for incremental fetches.

### LLM setup (OpenAI **or** a local model like Hermes)

Extraction talks to any **OpenAI-compatible** endpoint.

- **Cloud OpenAI:** set `OPENAI_API_KEY` (uses strict JSON-schema structured
  outputs, `gpt-4o-mini` by default; `OPENAI_MODEL` to override).
- **OpenRouter or any cloud gateway** (e.g. Nemotron, Hermes): set the base URL,
  your key, and the exact model slug:

  ```bash
  OPENAI_BASE_URL=https://openrouter.ai/api/v1
  OPENAI_API_KEY=sk-or-...            # your OpenRouter key
  OPENAI_MODEL=nvidia/nemotron-...    # exact slug from openrouter.ai/models
  ```

- **Local model (no cloud key):** run Hermes via Ollama / LM Studio /
  llama.cpp / vLLM and set `OPENAI_BASE_URL` + `OPENAI_MODEL`:

  ```bash
  ollama pull hermes3
  OPENAI_BASE_URL=http://localhost:11434/v1
  OPENAI_MODEL=hermes3
  # OPENAI_API_KEY can be left blank for local servers
  ```

For any non-OpenAI endpoint the app switches to JSON-object mode (validated /
repaired with Zod, since gateways and local runtimes don't all support strict
schemas) and, if a model rejects `response_format` entirely, retries relying on
the prompt alone. A configured LLM is used for extraction **even in mock mode**,
so you can exercise your model on the built-in fixture accounts with no X /
Supabase / OpenSea keys at all. Confirm the wiring at `/api/health` →
`llm: { mode: "openrouter" | "local" | "openai", model }`.

If no LLM is configured, the pipeline degrades to a deterministic rule-based
parser (regex/heuristics) — real extraction on real text, never fabricated.

### OpenSea setup

Add `OPENSEA_API_KEY` (OpenSea API v2). Used to look up a collection's drop
stages and compare them against the X-announced date.

## Environment variables

See [`.env.example`](./.env.example). Summary:

| Variable | Scope | Purpose |
| --- | --- | --- |
| `MINTDATE_MOCK_MODE` | server | `true` → fixtures, clearly labeled |
| `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` | public | Supabase client |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | DB writes (bypasses RLS) |
| `X_BEARER_TOKEN` | server | X API |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | server | extraction |
| `OPENSEA_API_KEY` | server | verification |
| `CRON_SECRET` | server | protects `/api/cron/monitor` |
| `RATE_LIMIT_SCAN_*` | server | scan rate limit tuning |

Never prefix a secret with `NEXT_PUBLIC_`.

## Running locally

```bash
npm run dev        # dev server (mock mode without keys)
npm run build      # production build
npm run start      # run the production build
```

## Testing

```bash
npm test           # vitest — normalization, dates/DST, extraction,
                   # dedup/merge, url safety, full mock-mode scan
```

## Vercel deployment

1. Import the repo into Vercel.
2. Add the environment variables above (Production + Preview).
3. Deploy. `npm run build` must pass (it does — CI-friendly).

### Cron configuration

[`vercel.json`](./vercel.json) registers a cron hitting `/api/cron/monitor`
every 15 minutes. Set `CRON_SECRET` in Vercel; Vercel Cron sends it as
`Authorization: Bearer <CRON_SECRET>` automatically. The endpoint also accepts
`?secret=` or an `x-cron-secret` header for manual testing.

The job finds watched projects (oldest-checked first), fetches only posts newer
than each project's stored `last_tweet_id`, re-runs detection, and updates
opportunities and `last_checked_at`.

## Security considerations

- **SSRF:** only `x.com` / `twitter.com` inputs are parsed; arbitrary URLs are
  never fetched server-side.
- **Phishing:** mint links are separated into `mint_url` vs `opensea_url`;
  OpenSea links validated against a host allowlist; external links show their
  hostname and open with `rel="noopener noreferrer"`. Nothing is labeled
  "verified" unless OpenSea actually agrees.
- **Secrets:** service-role key and all provider keys are server-only; logs are
  redacted; no secret is ever prefixed `NEXT_PUBLIC_`.
- **Abuse:** `/api/scan` is IP rate-limited; `/api/cron/monitor` requires a secret.
- **No `dangerouslySetInnerHTML`** — tweet text is rendered as plain text.
- **RLS** enabled on every table.

## Cost considerations

- Incremental fetching via `since_id`; newest tweet id persisted per project.
- A cheap keyword filter runs before any LLM call; posts are never AI-processed
  twice (`posts.processed` + `UNIQUE(x_post_id)`).
- X user lookups and OpenSea collections are cached in-process.
- The cron job processes a bounded batch and skips recently-checked projects.

## Known limitations

- In-memory rate limiting and caches are per-instance (swap for Redis/Upstash
  at scale); the memory store is for mock/dev only.
- OpenSea verification maps a single primary drop stage; complex multi-stage
  drops may need richer stage matching.
- No authentication yet (architected for it — the store and RLS are ready).
- Notifications ship as a console provider abstraction; Telegram/email/Discord
  are future channels.

## License

MIT (see repository).
