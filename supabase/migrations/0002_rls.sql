-- Row Level Security.
--
-- The app performs all writes through the service-role key (server-side only),
-- which bypasses RLS. We still enable RLS on every table so that the public
-- anon key cannot read or write directly. When auth is added later, add
-- per-user SELECT policies here; for the MVP the tables are server-only.

alter table public.projects          enable row level security;
alter table public.posts             enable row level security;
alter table public.opportunities     enable row level security;
alter table public.project_scan_runs enable row level security;

-- No policies are defined, so anon/authenticated clients get zero rows.
-- The service role (used by the server) bypasses RLS entirely.
--
-- Example future read-only public policy (commented out):
-- create policy "public read opportunities" on public.opportunities
--   for select using (true);
