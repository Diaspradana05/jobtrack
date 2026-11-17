update public.applications set job_description =
'Data Analyst Intern

Tentang Peran:
Bergabung dengan tim Business Intelligence untuk membantu mengolah data transaksi dan menyajikan insight bagi tim produk.

Tanggung Jawab:
- Mengambil dan membersihkan data menggunakan SQL
- Membuat dashboard dan laporan mingguan di Looker Studio atau Tableau
- Menganalisis tren penjualan dan perilaku pengguna
- Mempresentasikan temuan kepada tim non-teknis

Kualifikasi:
- Mahasiswa tingkat akhir jurusan Statistika, Informatika, Sistem Informasi, atau sejenisnya
- Menguasai SQL dan Excel; Python (pandas) menjadi nilai tambah
- Mampu berkomunikasi dengan jelas dan bekerja dalam tim
- Dapat magang minimal 3 bulan'
where company = 'Tokopedia' and position = 'Data Analyst Intern' and job_description is null;

update public.applications set job_description =
'Backend Developer Intern

Tanggung Jawab:
- Mengembangkan dan memelihara layanan REST API
- Menulis query dan migrasi database PostgreSQL
- Menulis unit test dan berpartisipasi dalam code review

Kualifikasi:
- Mahasiswa Teknik Informatika atau sejenisnya
- Memahami dasar pemrograman backend (Go atau bahasa lain) dan basis data relasional
- Familiar dengan Git dan konsep API
- Antusias belajar sistem terdistribusi'
where company = 'Gojek' and position = 'Backend Developer Intern' and job_description is null;

update public.applications set job_description =
'Frontend Developer Intern

Tanggung Jawab:
- Membangun antarmuka web yang responsif memakai React dan TypeScript
- Berkolaborasi dengan desainer untuk mengimplementasikan desain UI
- Memperbaiki bug dan meningkatkan performa halaman

Kualifikasi:
- Menguasai HTML, CSS, JavaScript, dan dasar React
- Pernah membuat proyek web (portofolio atau GitHub menjadi nilai tambah)
- Memahami dasar aksesibilitas dan desain responsif
- Mampu bekerja jarak jauh dengan komunikasi yang baik'
where company = 'Traveloka' and position = 'Frontend Developer Intern' and job_description is null;
