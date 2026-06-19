-- Extended ATS persistence: full result JSON and job description
alter table public.resumes add column if not exists ats_job_description text;
alter table public.resumes add column if not exists ats_result jsonb;
