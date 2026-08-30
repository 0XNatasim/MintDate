-- MintDate initial schema.
-- Apply with the Supabase CLI (`supabase db push`) or paste into the SQL editor.
-- Idempotent-ish: uses IF NOT EXISTS where practical.

create extension if not exists "pgcrypto";

-- ── projects ────────────────────────────────────────────────────────────────
create table if not exists public.projects (
  id              uuid primary key default gen_random_uuid(),
  x_username      text not null,
  x_user_id       text,
  name            text,
  description     text,
  avatar_url      text,
  profile_url     text,
  watching        boolean not null default false,
  last_tweet_id   text,
  last_checked_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Case-insensitive uniqueness on username.
create unique index if not exists projects_x_username_key
  on public.projects (lower(x_username));
create unique index if not exists projects_x_user_id_key
  on public.projects (x_user_id) where x_user_id is not null;
create index if not exists projects_watching_idx on public.projects (watching);
create index if not exists projects_last_checked_idx on public.projects (last_checked_at);

-- ── posts ───────────────────────────────────────────────────────────────────
create table if not exists public.posts (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  x_post_id   text not null,
  text        text not null,
  post_url    text not null,
  posted_at   timestamptz not null,
  processed   boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (x_post_id)
);

create index if not exists posts_project_idx on public.posts (project_id);
create index if not exists posts_posted_at_idx on public.posts (posted_at desc);

-- ── opportunities ───────────────────────────────────────────────────────────
create table if not exists public.opportunities (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references public.projects (id) on delete cascade,
  type                text not null default 'unknown',
  title               text,
  mint_date           timestamptz,
  mint_end_date       timestamptz,
  timezone            text,
  chain               text,
  price               text,
  currency            text,
  supply              text,
  mint_url            text,
  opensea_url         text,
  source_post_id      text,
  source_post_url     text,
  source_text         text,
  confidence          text not null default 'low',
  verification_status text not null default 'unverified',
  status              text not null default 'unknown',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint opportunities_type_chk check (type in (
    'allowlist','presale','public','free','claim','auction',
    'snapshot','registration','unknown')),
  constraint opportunities_status_chk check (status in (
    'unknown','rumored','announced','verified','live','ended','cancelled')),
  constraint opportunities_verification_chk check (verification_status in (
    'unverified','x_only','opensea_verified','conflicting')),
  constraint opportunities_confidence_chk check (confidence in ('high','medium','low'))
);

create index if not exists opportunities_project_idx on public.opportunities (project_id);
create index if not exists opportunities_mint_date_idx on public.opportunities (mint_date);
create index if not exists opportunities_status_idx on public.opportunities (status);

-- ── project_scan_runs (observability) ───────────────────────────────────────
create table if not exists public.project_scan_runs (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references public.projects (id) on delete cascade,
  started_at          timestamptz not null default now(),
  completed_at        timestamptz,
  posts_fetched       integer not null default 0,
  posts_processed     integer not null default 0,
  opportunities_found integer not null default 0,
  status              text not null default 'running',
  error_message       text,
  constraint scan_runs_status_chk check (status in ('running','completed','failed'))
);

create index if not exists scan_runs_project_idx on public.project_scan_runs (project_id);
create index if not exists scan_runs_started_idx on public.project_scan_runs (started_at desc);

-- ── updated_at trigger ──────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

drop trigger if exists opportunities_set_updated_at on public.opportunities;
create trigger opportunities_set_updated_at before update on public.opportunities
  for each row execute function public.set_updated_at();
