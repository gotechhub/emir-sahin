-- Supabase SQL Editor'da bir kez çalıştırın.
-- Mevcut site_content tablosuna erişim yetkilerini düzeltir; tekrar çalıştırılabilir.
grant usage on schema public to anon, authenticated;
grant select on table public.site_content to anon;
grant select, insert, update, delete on table public.site_content to authenticated;
