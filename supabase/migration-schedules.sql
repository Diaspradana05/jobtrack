create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  kind text not null check (kind in ('deadline','interview','follow_up')),
  due_date date not null,
  due_time time,            -- opsional (WIB); kosong = sepanjang hari
  note text,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists schedules_user_due_idx
  on public.schedules (user_id, done, due_date);
create index if not exists schedules_application_idx
  on public.schedules (application_id);

alter table public.schedules enable row level security;
drop policy if exists "own schedules" on public.schedules;
create policy "own schedules" on public.schedules
  for all using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.applications a where a.id = application_id and a.user_id = (select auth.uid()))
  );
