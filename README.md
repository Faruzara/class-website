# Web Kelas XI TP2

Portal informasi kelas XI Teknik Pemesinan 2 SMKN Jambu. Aplikasi ini menyediakan beranda publik, jadwal Week 1/Week 2, daftar anggota, galeri, pengumuman, Moments, serta dashboard Admin dan Owner.

## Teknologi

- Next.js 15.5.24 dengan App Router
- React 19.3.0 dan TypeScript
- Supabase untuk database, autentikasi aplikasi, dan data publik
- Cloudinary atau Supabase Storage untuk media publik
- Tailwind CSS, Motion, GSAP, dan Lucide React untuk antarmuka
- Vercel Analytics dan Speed Insights

## Menjalankan secara lokal

Prasyarat: Node.js 24.x dan project Supabase.

```bash
npm install
Copy-Item .env.example .env.local
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000).

## Environment variables

Salin `.env.example` ke `.env.local`, lalu isi:

### Supabase

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — hanya server-side, jangan expose ke client

### Penyimpanan media

Gunakan `MEDIA_STORAGE_PROVIDER=supabase` atau `cloudinary`.

Jika memakai Cloudinary, isi:

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET` — hanya server-side
- `CLOUDINARY_ENV_FOLDER` — misalnya `dev` untuk lokal dan `prod` untuk Vercel

Upload baru memakai struktur folder `<root>/<environment>/<kategori>/...`. Media lama tetap dapat diakses selama belum dihapus.

### Session dan aplikasi

- `JWT_SECRET` — secret acak minimal 32 karakter
- `OWNER_MASTER_KEY` — master key Owner, jangan dibagikan
- `NEXT_PUBLIC_APP_NAME`
- `NEXT_PUBLIC_CLASS_NAME`
- `NEXT_PUBLIC_SCHOOL_NAME`
- `NEXT_PUBLIC_HERO_IMAGE_URL` — opsional, sebagai fallback foto hero
- `NEXT_PUBLIC_ABOUT_CLASS` — opsional, sebagai fallback deskripsi kelas

Vercel Analytics dan Speed Insights tidak memerlukan environment variable tambahan. Komponennya sudah dipasang di root `app/layout.tsx`.

## Database

1. Jalankan `supabase-schema.sql` di SQL Editor Supabase.
2. Jalankan migration tambahan yang diperlukan sesuai fitur yang digunakan. File migration tersedia di root repository, antara lain untuk access control, RLS hardening, Moments, expiry pengumuman, feedback, galeri, hero lock, dan pergantian jadwal.
3. Pastikan nilai environment lokal sesuai project Supabase yang digunakan.

Untuk mengecek migration dan aturan RLS yang sudah disiapkan, jalankan isi `supabase-verify-migrations.sql` di SQL Editor Supabase.

## Route utama

| Route | Akses | Fungsi |
|---|---|---|
| `/` | Publik | Beranda, Moments, galeri, dan Class Members |
| `/pengumuman` | Publik | Daftar pengumuman |
| `/jadwal` | Publik | Jadwal Week 1/Week 2 dan status minggu aktif |
| `/anggota` | Publik | Daftar anggota kelas |
| `/galeri` | Publik | Galeri foto dengan pemuatan bertahap |
| `/admin/login` | Publik | Login Admin |
| `/admin` | Admin/temporary access | Dashboard pengelolaan |
| `/owner/login` | Owner | Login Owner |
| `/owner` | Owner | Dashboard dan pengaturan Owner |

Admin mengelola jadwal, anggota, galeri, pengumuman, dan Moments sesuai hak akses. Owner mengelola akses Admin, konten, feedback, pengumuman sistem, Moments, dan aktivitas.

## Jadwal

Jadwal menggunakan dua set data: Week 1 dan Week 2. Minggu aktif dapat mengikuti pengaturan otomatis atau dipindahkan manual dari dashboard Admin ketika jadwal aktual tidak sesuai.

Warna kartu ditentukan otomatis dari mapel dan ruangan. Admin dapat memilih warna khusus ketika menambah atau mengedit jadwal; pilihan **Otomatis** mempertahankan aturan warna bawaan. Jalankan `supabase-migration-schedule-color.sql` sebelum memakai warna khusus pada database lama.

Dashboard Admin menyediakan fitur **Import PDF** untuk file keluaran aSc Timetables. Sistem mendeteksi seluruh kelas dan nomor halaman secara otomatis, menampilkan preview, lalu menyediakan mode **Gabungkan** atau **Ganti Jadwal**. Nama kelas dan nomor halaman tidak di-hardcode, sehingga fitur tetap dapat digunakan ketika kelas naik tingkat.

File dibatasi maksimal 10 MB dan baru disimpan setelah Admin memilih kelas serta mengonfirmasi import. Mode Gabungkan dibatalkan jika hasil PDF bertabrakan dengan jadwal lain.

## Media dan folder environment

Migrasi media publik ke Cloudinary tersedia dalam mode dry-run:

```bash
npm run media:migrate:dry
```

Jika hasil dry-run sudah sesuai, proses apply dapat dijalankan dengan:

```bash
npm run media:migrate
```

Lakukan dry-run terlebih dahulu. Script migrasi tidak ditujukan untuk Moments privat.

## Pemeriksaan sebelum deploy

```bash
npx tsc --noEmit
npm run build
```

Jangan memasukkan `.env.local` atau secret server ke repository.

## Deploy ke Vercel

1. Push repository ke GitHub.
2. Import repository tersebut ke Vercel.
3. Tambahkan semua environment variable dari `.env.local` di Vercel.
4. Set `MEDIA_STORAGE_PROVIDER=cloudinary` jika production memakai Cloudinary.
5. Set `CLOUDINARY_ENV_FOLDER=prod` untuk upload production.
6. Deploy, lalu buka situs production untuk mengirim event pertama ke Analytics dan Speed Insights.

Tidak perlu memasang package tambahan di Vercel; kedua integrasi Vercel sudah menjadi dependency aplikasi.
