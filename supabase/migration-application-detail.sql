alter table public.applications
  add column if not exists job_description text,
  add column if not exists match_score smallint check (match_score between 0 and 100),
  add column if not exists match_analysis text,
  add column if not exists interview_prep text,
  add column if not exists cover_letter text,
  add column if not exists ai_updated jsonb not null default '{}'::jsonb;
