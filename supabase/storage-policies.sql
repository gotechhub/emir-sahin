-- Run once in Supabase SQL Editor after creating the portfolio-media bucket.
-- Re-running this file is safe.
drop policy if exists "authenticated editors can upload portfolio media" on storage.objects;
drop policy if exists "authenticated editors can update portfolio media" on storage.objects;
drop policy if exists "authenticated editors can delete portfolio media" on storage.objects;

create policy "authenticated editors can upload portfolio media"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'portfolio-media');

create policy "authenticated editors can update portfolio media"
  on storage.objects for update to authenticated
  using (bucket_id = 'portfolio-media')
  with check (bucket_id = 'portfolio-media');

create policy "authenticated editors can delete portfolio media"
  on storage.objects for delete to authenticated
  using (bucket_id = 'portfolio-media');
