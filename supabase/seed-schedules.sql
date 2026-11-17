insert into public.schedules (user_id, application_id, kind, due_date, due_time, note)
select a.user_id, a.id, v.kind, (now() at time zone 'Asia/Jakarta')::date + v.day_offset, v.due_time::time, v.note
from public.applications a
join (values
  ('Tokopedia',          'interview', 2,  '10:00', '[contoh] Interview HR via Google Meet, siapkan portofolio.'),
  ('Gojek',              'follow_up', 1,  null,    '[contoh] Tanyakan kabar proses seleksi ke recruiter.'),
  ('Traveloka',          'follow_up', -2, null,    '[contoh] Kirim email follow-up (sudah lewat).'),
  ('Bukalapak',          'deadline',  4,  null,    '[contoh] Batas pendaftaran program magang.'),
  ('PT Semen Indonesia', 'deadline',  6,  null,    '[contoh] Balas tawaran sebelum batas waktu.'),
  ('Telkom Indonesia',   'interview', 9,  '14:30', '[contoh] Tes wawancara user.')
) as v(company, kind, day_offset, due_time, note) on a.company = v.company
where a.user_id = (select id from auth.users order by created_at limit 1)
  and not exists (
    select 1 from public.schedules s where s.application_id = a.id and s.note = v.note
  );
