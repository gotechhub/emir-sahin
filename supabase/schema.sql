-- Emir portföy — Supabase kurulumu.
-- Supabase SQL Editor'da BİR KEZ çalıştırın. Tekrar çalıştırmak güvenlidir.
-- Öncesinde: Storage bölümünde "portfolio-media" adında (public) bir bucket oluşturun.

-- 1) İçerik tablosu (tek satır: id = 'main')
create table if not exists public.site_content (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

-- 2) API rolleri için yetkiler
grant usage on schema public to anon, authenticated;
grant select on table public.site_content to anon;
grant select, insert, update, delete on table public.site_content to authenticated;

-- 3) Satır düzeyi güvenlik (RLS)
alter table public.site_content enable row level security;

-- Ziyaretçi (anon) yalnızca yayınlanan tek kaydı okuyabilir.
drop policy if exists "public can read published portfolio" on public.site_content;
create policy "public can read published portfolio"
  on public.site_content for select
  to anon, authenticated
  using (id = 'main');

-- Giriş yapmış editör (panel) içeriği ekley/güncelle/sil.
-- Rol kısıtı "to authenticated" ile uygulanır; eski auth.role() yazımı kullanılmaz.
drop policy if exists "authenticated editors can update portfolio" on public.site_content;
drop policy if exists "authenticated editors manage portfolio" on public.site_content;
create policy "authenticated editors manage portfolio"
  on public.site_content for all
  to authenticated
  using (true)
  with check (true);

-- 4) Medya deposu izinleri ("portfolio-media" bucket'ı için)
-- Ziyaretçi medyayı okuyabilsin (bucket public değilse de çalışır).
drop policy if exists "public can read portfolio media" on storage.objects;
create policy "public can read portfolio media"
  on storage.objects for select
  using (bucket_id = 'portfolio-media');

-- Giriş yapmış editör medya yükleyip güncelleyip silebilsin.
-- (Parçalı/resumable yüklemeler de bu insert iznini kullanır.)
drop policy if exists "authenticated editors can upload portfolio media" on storage.objects;
create policy "authenticated editors can upload portfolio media"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'portfolio-media');

drop policy if exists "authenticated editors can update portfolio media" on storage.objects;
create policy "authenticated editors can update portfolio media"
  on storage.objects for update to authenticated
  using (bucket_id = 'portfolio-media')
  with check (bucket_id = 'portfolio-media');

drop policy if exists "authenticated editors can delete portfolio media" on storage.objects;
create policy "authenticated editors can delete portfolio media"
  on storage.objects for delete to authenticated
  using (bucket_id = 'portfolio-media');
