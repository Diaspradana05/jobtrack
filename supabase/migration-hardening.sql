-- applications
drop policy if exists "own applications" on public.applications;
create policy "own applications" on public.applications
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- cv_documents
drop policy if exists "own cv docs" on public.cv_documents;
create policy "own cv docs" on public.cv_documents
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- cv_chunks
drop policy if exists "own cv chunks" on public.cv_chunks;
create policy "own cv chunks" on public.cv_chunks
  for all using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.cv_documents d where d.id = document_id and d.user_id = (select auth.uid()))
  );

-- schedules
drop policy if exists "own schedules" on public.schedules;
create policy "own schedules" on public.schedules
  for all using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.applications a where a.id = application_id and a.user_id = (select auth.uid()))
  );

-- interview_sessions
drop policy if exists "own interview sessions" on public.interview_sessions;
create policy "own interview sessions" on public.interview_sessions
  for all using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.applications a where a.id = application_id and a.user_id = (select auth.uid()))
  );

-- reminder_settings
drop policy if exists "own reminder settings" on public.reminder_settings;
create policy "own reminder settings" on public.reminder_settings
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- fungsi pencarian CV: hanya pengguna yang sudah masuk
revoke all on function public.match_cv_chunks(vector, int) from public, anon;
grant execute on function public.match_cv_chunks(vector, int) to authenticated;
