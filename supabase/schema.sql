create extension if not exists vector with schema extensions;

-- 1. Tabel lamaran
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  company text not null,
  position text not null,
  status text not null default 'applied'
    check (status in ('wishlist','applied','interview','offer','rejected')),
  location text,
  job_url text,
  salary text,
  notes text,
  applied_date date default ((now() at time zone 'Asia/Jakarta')::date),
  created_at timestamptz not null default now()
);

-- tanggal default mengikuti WIB (kalau tabel sudah pernah dibuat sebelumnya)
alter table public.applications
  alter column applied_date set default ((now() at time zone 'Asia/Jakarta')::date);

create index if not exists applications_user_created_idx
  on public.applications (user_id, created_at desc);

alter table public.applications enable row level security;
drop policy if exists "own applications" on public.applications;
create policy "own applications" on public.applications
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- 2. Dokumen CV + potongan teks (chunk) untuk RAG
create table if not exists public.cv_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  file_name text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.cv_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  document_id uuid not null references public.cv_documents(id) on delete cascade,
  content text not null,
  embedding vector(768)
);

create index if not exists cv_chunks_document_idx on public.cv_chunks (document_id);
create index if not exists cv_chunks_user_idx on public.cv_chunks (user_id);

alter table public.cv_documents enable row level security;
alter table public.cv_chunks enable row level security;

drop policy if exists "own cv docs" on public.cv_documents;
create policy "own cv docs" on public.cv_documents
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "own cv chunks" on public.cv_chunks;
create policy "own cv chunks" on public.cv_chunks
  for all using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.cv_documents d where d.id = document_id and d.user_id = (select auth.uid()))
  );

-- 3. Fungsi pencarian vektor (hanya mengembalikan data milik user yang login)
create or replace function public.match_cv_chunks(
  query_embedding vector(768),
  match_count int default 4
)
returns table (id uuid, content text, similarity float)
language sql stable
security invoker
set search_path = public, extensions
as $$
  select c.id, c.content, (1 - (c.embedding <=> query_embedding))::float as similarity
  from public.cv_chunks c
  where c.user_id = auth.uid()
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

revoke all on function public.match_cv_chunks(vector, int) from public, anon;
grant execute on function public.match_cv_chunks(vector, int) to authenticated;

-- 4. Agenda: pengingat & jadwal (deadline, interview, follow-up)
create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  kind text not null check (kind in ('deadline','interview','follow_up')),
  due_date date not null,
  due_time time,
  note text,
  done boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists schedules_user_due_idx on public.schedules (user_id, done, due_date);
create index if not exists schedules_application_idx on public.schedules (application_id);
alter table public.schedules enable row level security;
drop policy if exists "own schedules" on public.schedules;
create policy "own schedules" on public.schedules
  for all using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.applications a where a.id = application_id and a.user_id = (select auth.uid()))
  );

-- 5. Detail lamaran: deskripsi lowongan + hasil AI (analisis kecocokan, persiapan interview, cover letter)
alter table public.applications
  add column if not exists job_description text,
  add column if not exists match_score smallint check (match_score between 0 and 100),
  add column if not exists match_analysis text,
  add column if not exists interview_prep text,
  add column if not exists cover_letter text,
  add column if not exists ai_updated jsonb not null default '{}'::jsonb;

-- 6. Simulasi interview: sesi latihan per lamaran
create table if not exists public.interview_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  mode text not null default 'mixed' check (mode in ('mixed','hr','technical')),
  total_questions smallint not null default 5 check (total_questions between 1 and 10),
  status text not null default 'active' check (status in ('active','finished')),
  turns jsonb not null default '[]'::jsonb,
  report jsonb,
  avg_score numeric(4,1),
  context text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists interview_sessions_app_idx on public.interview_sessions (application_id, created_at desc);
alter table public.interview_sessions enable row level security;
drop policy if exists "own interview sessions" on public.interview_sessions;
create policy "own interview sessions" on public.interview_sessions
  for all using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.applications a where a.id = application_id and a.user_id = (select auth.uid()))
  );

-- 7. Pengingat email: pengaturan ringkasan agenda harian
create table if not exists public.reminder_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  send_hour smallint not null default 7 check (send_hour between 0 and 23),
  lead_days smallint not null default 1 check (lead_days between 0 and 14),
  last_sent_on date,
  last_attempt_at timestamptz,
  last_status text,
  created_at timestamptz not null default now()
);
alter table public.reminder_settings enable row level security;
drop policy if exists "own reminder settings" on public.reminder_settings;
create policy "own reminder settings" on public.reminder_settings
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
