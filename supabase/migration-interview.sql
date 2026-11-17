create table if not exists public.interview_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  mode text not null default 'mixed' check (mode in ('mixed','hr','technical')),
  total_questions smallint not null default 5 check (total_questions between 1 and 10),
  status text not null default 'active' check (status in ('active','finished')),
  turns jsonb not null default '[]'::jsonb,   -- [{q, isFollowUp, a, score, good[], improve[], sample}]
  report jsonb,                               -- {summary, strengths[], toPractice[], nextSteps[]}
  avg_score numeric(4,1),
  context text,                               -- potongan CV relevan saat sesi dimulai (dipakai ulang tiap giliran)
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists interview_sessions_app_idx
  on public.interview_sessions (application_id, created_at desc);

alter table public.interview_sessions enable row level security;
drop policy if exists "own interview sessions" on public.interview_sessions;
create policy "own interview sessions" on public.interview_sessions
  for all using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.applications a where a.id = application_id and a.user_id = (select auth.uid()))
  );
