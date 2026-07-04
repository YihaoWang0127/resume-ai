# Database

```sql
-- Resumes table
CREATE TABLE resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  resume_data JSONB NOT NULL,
  detected_industry TEXT DEFAULT 'general',
  career_stage TEXT CHECK (career_stage IN ('student', 'early', 'experienced')),
  ats_score INTEGER,
  ats_score_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cover Letters table
CREATE TABLE cover_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  resume_id UUID REFERENCES resumes(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  company_name TEXT,
  job_description TEXT,
  tone TEXT DEFAULT 'professional',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Both tables have Row Level Security enabled
-- Users can only access their own data

-- User Preferences table (AI page → AI Preferences, Settings → Notifications)
CREATE TABLE user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tone TEXT NOT NULL DEFAULT 'professional'
    CHECK (tone IN ('professional', 'conversational', 'executive')),
  writing_style TEXT NOT NULL DEFAULT 'concise'
    CHECK (writing_style IN ('concise', 'detailed', 'keyword-optimized')),
  industry TEXT NOT NULL DEFAULT '',
  job_level TEXT NOT NULL DEFAULT 'mid'
    CHECK (job_level IN ('junior', 'mid', 'senior', 'executive')),
  ats_mode BOOLEAN NOT NULL DEFAULT false,
  notify_export_complete BOOLEAN NOT NULL DEFAULT true,
  notify_product_updates BOOLEAN NOT NULL DEFAULT false,
  default_model TEXT NOT NULL DEFAULT 'claude-sonnet-4-6'
    CHECK (default_model IN ('claude-sonnet-4-6', 'claude-sonnet-5', 'claude-opus-4-7', 'claude-opus-4-8', 'claude-fable-5')),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- RLS enabled — users can only read/write their own row

-- Profiles table (Profile page → Personal Info + Work Experience)
CREATE TABLE profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  job_title TEXT NOT NULL DEFAULT '',
  experience JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- RLS enabled — users can only read/write their own row

-- AI Usage Log table (AI page → AI Usage)
CREATE TABLE ai_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL
    CHECK (action IN ('parse', 'enrich', 'tailor', 'cover_letter', 'ats_score')),
  model TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- RLS enabled — users can only read/write their own rows
-- Indexed on (user_id, created_at DESC) for the AI Usage card
```

**Storage:** `avatars` bucket (public read, owner-only write/update/delete by `user_id` folder) for Profile → Account avatar uploads.

**RPC:** `delete_user_account()` — `SECURITY DEFINER` function called from Settings → Security → Delete Account. Cascades through `cover_letters`, `resumes`, `user_preferences`, `profiles`, and `ai_usage_log`, then removes the `auth.users` row.

See `supabase/migrations/20260611_user_preferences.sql`,
`supabase/migrations/20260613_profile_and_ai_usage.sql`, and
`supabase/migrations/20260703_default_ai_model.sql` (adds `default_model` to `user_preferences`) for the full migrations.
