# Web Kelas XI TP2

Portal informasi kelas berbasis Next.js 14 + Supabase.

## Stack
- **Next.js 14** (App Router) — frontend + API routes
- **Supabase** — database PostgreSQL + storage foto
- **Tailwind CSS** — styling
- **jose** — JWT session
- **bcryptjs** — hashing key

---

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Buat project di Supabase
- Daftar di [supabase.com](https://supabase.com)
- Buat project baru
- Masuk ke **SQL Editor**, copy-paste isi `supabase-schema.sql` dan jalankan

### 3. Isi environment variables
```bash
cp .env.example .env.local
```
Lalu isi nilai-nilai berikut di `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL` — dari Settings > API di Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — dari Settings > API
- `SUPABASE_SERVICE_ROLE_KEY` — dari Settings > API (jangan expose!)
- `JWT_SECRET` — random string panjang, bisa generate dengan:
  ```bash
  openssl rand -hex 32
  ```
- `OWNER_MASTER_KEY` — master key kamu pribadi, simpan baik-baik!

### 4. Jalankan development server
```bash
npm run dev
```

---

## Struktur Route

| Route | Akses | Keterangan |
|-------|-------|------------|
| `/` | Publik | Beranda |
| `/pengumuman` | Publik | List pengumuman |
| `/jadwal` | Publik | Jadwal pelajaran |
| `/anggota` | Publik | Daftar anggota |
| `/galeri` | Publik | Galeri foto |
| `/admin/login` | Publik | Login admin |
| `/admin` | Admin/Temp | Dashboard admin |
| `/admin/pengumuman` | Admin/Temp | Kelola pengumuman |
| `/admin/jadwal` | Admin/Temp | Kelola jadwal |
| `/admin/anggota` | Admin/Temp | Kelola anggota |
| `/admin/galeri` | Admin/Temp | Kelola galeri |
| `/admin/temp-key` | Admin only | Generate temp key |
| `/owner/login` | Owner only | Login owner |
| `/owner` | Owner only | Dashboard owner |

---

## Sistem Key

### Admin Key (Permanen)
- Format: `ADM-xxxx-xxxx-xxxx`
- Di-generate oleh Owner dari `/owner`
- Permanen sampai di-revoke oleh Owner
- Maksimal 3 slot aktif

### Temp Key (1 Jam)
- Format: `TMP-xxxx-xxxx-xxxx`
- Di-generate oleh Admin dari `/admin/temp-key`
- Expired otomatis setelah 1 jam
- Wajib isi label "untuk siapa"
- Tidak bisa generate temp key lagi (anti-chain)

### Owner Key
- Disimpan di `OWNER_MASTER_KEY` di `.env.local`
- Akses via `/owner/login`
- Tidak pernah masuk database

---

## Deploy ke Vercel
1. Push ke GitHub
2. Import di [vercel.com](https://vercel.com)
3. Isi semua environment variables di dashboard Vercel
4. Deploy!

Untuk custom domain: Settings > Domains di project Vercel.
