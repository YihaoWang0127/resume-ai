-- Profile page, AI usage tracking, notification preferences, and ATS score persistence
-- Run this manually in the Supabase SQL editor (or via `supabase db push`).

-- ── profiles table ────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text not null default '',
  address text not null default '',
  job_title text not null default '',
  experience jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = user_id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = user_id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = user_id);


-- ── ai_usage_log table ───────────────────────────────────────────────────────
create table if not exists public.ai_usage_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null
    check (action in ('parse', 'enrich', 'tailor', 'cover_letter', 'ats_score')),
  model text not null,
  created_at timestamptz not null default now()
);

alter table public.ai_usage_log enable row level security;

create policy "Users can view own ai usage"
  on public.ai_usage_log for select
  using (auth.uid() = user_id);

create policy "Users can insert own ai usage"
  on public.ai_usage_log for insert
  with check (auth.uid() = user_id);

create index if not exists ai_usage_log_user_id_created_at_idx
  on public.ai_usage_log (user_id, created_at desc);


-- ── user_preferences additions: notification toggles ────────────────────────
alter table public.user_preferences add column if not exists notify_export_complete boolean not null default true;
alter table public.user_preferences add column if not exists notify_product_updates boolean not null default false;


-- ── resumes additions: persisted ATS score ───────────────────────────────────
alter table public.resumes add column if not exists ats_score integer;
alter table public.resumes add column if not exists ats_score_updated_at timestamptz;


-- ── self-service account deletion: include new tables ───────────────────────
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
  delete from public.profiles where user_id = auth.uid();
  delete from public.ai_usage_log where user_id = auth.uid();
  delete from auth.users where id = auth.uid();
end;
$$;

grant execute on function public.delete_user_account() to authenticated;
