-- Run once in Supabase SQL Editor.
create table if not exists public.site_content (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.site_content enable row level security;

-- The public portfolio can read the single published record.
create policy "public can read published portfolio"
  on public.site_content for select using (id = 'main');

-- Dashboard sync uses the anon key. Replace this policy with Supabase Auth
-- before exposing the admin route publicly.
create policy "authenticated editors can update portfolio"
  on public.site_content for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
