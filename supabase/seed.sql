insert into public.applications (user_id, company, position, status, location, salary, notes, applied_date)
select u.id, v.company, v.position, v.status, v.location, v.salary, v.notes, current_date - v.days_ago
from (select id from auth.users order by created_at limit 1) u
cross join (values
  ('Tokopedia',        'Data Analyst Intern',      'interview', 'Jakarta',   'Rp 3.500.000', 'Interview HR hari Kamis, siapkan portofolio.', 3),
  ('Gojek',            'Backend Developer Intern', 'applied',   'Jakarta',   'Rp 4.000.000', 'Stack: Go dan PostgreSQL.',                    6),
  ('Traveloka',        'Frontend Developer Intern','applied',   'Remote',    null,           'React dan TypeScript.',                        9),
  ('Bank Mandiri',     'IT Support Staff',         'rejected',  'Surabaya',  null,           'Belum sesuai kualifikasi.',                    14),
  ('PT Semen Indonesia','Programmer Intern',       'offer',     'Gresik',    'Rp 2.800.000', 'Tawaran masuk, balas sebelum akhir bulan.',    18),
  ('Bukalapak',        'Software Engineer Intern', 'wishlist',  'Jakarta',   null,           'Lowongan dibuka bulan depan.',                 0),
  ('Telkom Indonesia', 'Web Developer',            'applied',   'Surabaya',  null,           'Lamar lewat portal karier.',                   25),
  ('Shopee',           'QA Engineer Intern',       'rejected',  'Jakarta',   null,           'Gagal di tes online.',                         32)
) as v(company, position, status, location, salary, notes, days_ago);
