-- AI model switcher: let users set a default Claude model for AI Enhancement
-- Run this manually in the Supabase SQL editor (or via `supabase db push`).

alter table public.user_preferences
  add column if not exists default_model text not null default 'claude-sonnet-4-6'
    check (default_model in (
      'claude-sonnet-4-6',
      'claude-sonnet-5',
      'claude-opus-4-7',
      'claude-opus-4-8',
      'claude-fable-5'
    ));
