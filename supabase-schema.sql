-- Tendance cloud: exécuter dans Supabase SQL Editor.
create table if not exists public.wardrobe_items (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text not null,
  subcategory text not null default '',
  color text not null,
  aesthetics jsonb not null default '["Tous les styles"]'::jsonb,
  occasions jsonb not null default '["Toutes les occasions"]'::jsonb,
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.saved_outfits (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  occasion text not null default 'Toutes les occasions',
  day integer,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.wardrobe_items enable row level security;
alter table public.saved_outfits enable row level security;
create policy "Users manage their own wardrobe" on public.wardrobe_items
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage their own outfits" on public.saved_outfits
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wardrobe-photos', 'wardrobe-photos', false, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 8388608, allowed_mime_types = excluded.allowed_mime_types;

create policy "Users read their own wardrobe photos" on storage.objects
  for select to authenticated using (bucket_id = 'wardrobe-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users upload their own wardrobe photos" on storage.objects
  for insert to authenticated with check (bucket_id = 'wardrobe-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users update their own wardrobe photos" on storage.objects
  for update to authenticated using (bucket_id = 'wardrobe-photos' and (storage.foldername(name))[1] = (select auth.uid())::text) with check (bucket_id = 'wardrobe-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users delete their own wardrobe photos" on storage.objects
  for delete to authenticated using (bucket_id = 'wardrobe-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
