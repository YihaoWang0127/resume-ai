-- Settings page: AI preferences, avatar storage, and account deletion
-- Run this manually in the Supabase SQL editor (or via `supabase db push`).

-- ── user_preferences table ───────────────────────────────────────────────────
create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tone text not null default 'professional'
    check (tone in ('professional', 'conversational', 'executive')),
  writing_style text not null default 'concise'
    check (writing_style in ('concise', 'detailed', 'keyword-optimized')),
  industry text not null default '',
  job_level text not null default 'mid'
    check (job_level in ('junior', 'mid', 'senior', 'executive')),
  ats_mode boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

create policy "Users can view own preferences"
  on public.user_preferences for select
  using (auth.uid() = user_id);

create policy "Users can insert own preferences"
  on public.user_preferences for insert
  with check (auth.uid() = user_id);

create policy "Users can update own preferences"
  on public.user_preferences for update
  using (auth.uid() = user_id);


-- ── avatars storage bucket ───────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Avatar images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can update their own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete their own avatar"
  on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);


-- ── self-service account deletion ────────────────────────────────────────────
-- SECURITY DEFINER lets an authenticated user delete their own auth.users row,
-- which they otherwise have no privileges to do directly.
create or replace function public.delete_user_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.cover_letters where user_id = auth.uid();
  delete from public.resumes where user_id = auth.uid();
  delete from public.user_preferences where user_id = auth.uid();
  delete from auth.users where id = auth.uid();
end;
$$;

grant execute on function public.delete_user_account() to authenticated;
