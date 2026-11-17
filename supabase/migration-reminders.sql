create table if not exists public.reminder_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  enabled boolean not null default false,                       -- opt-in: mati sampai pengguna menyalakan
  send_hour smallint not null default 7 check (send_hour between 0 and 23),   -- jam kirim (WIB)
  lead_days smallint not null default 1 check (lead_days between 0 and 14),   -- sertakan jadwal sampai N hari ke depan
  last_sent_on date,                                            -- tanggal (WIB) ringkasan terakhir terkirim
  last_attempt_at timestamptz,
  last_status text,
  created_at timestamptz not null default now()
);

alter table public.reminder_settings enable row level security;
drop policy if exists "own reminder settings" on public.reminder_settings;
create policy "own reminder settings" on public.reminder_settings
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
