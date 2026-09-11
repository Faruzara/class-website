# Moments — capture dan publish

## Aktifkan di Supabase

Jalankan **seluruh isi `supabase-migration-moments.sql`**, lalu **`supabase-migration-moments-captured-at.sql`**, sebagai query baru di SQL Editor project yang sama. Jika migration dasar sudah pernah dijalankan, cukup jalankan migration `captured-at` yang baru. Tidak perlu menghapus/menggabungkan query lama. Migration belum dijalankan otomatis.

Migration menambahkan tabel `moments`, trigger lifetime, fungsi pembacaan aktif, index dan bucket **private `moments`**. Bucket publik `web-kelas` tidak diubah. Policy restrictive khusus Moments mencegah policy Storage umum milik fitur lain memberikan akses ke bucket ini.

Original: `moments/{uuid}/original.jpg`. Preview: `moments/{uuid}/preview.jpg`. Keduanya disimpan private. Homepage hanya mendapatkan URL proxy preview maksimum **16px pada sisi terpanjang**, tidak pernah original/public URL/signed URL original. Tidak ada policy anon/authenticated untuk membaca tabel ini; server menggunakan service-role yang tidak dikirim ke browser.

## Alur dan izin

- Owner, Admin, Temp Admin: **Ambil Moment → shutter → upload/publish**, tanpa file picker, crop, caption, preview konfirmasi atau tombol kirim.
- Session existing diverifikasi oleh server; role/id uploader dari body diabaikan. Temp Admin yang expired/revoked ditolak pada request baru.
- Owner saja dapat membuka daftar pengelolaan dan menghapus. Request DELETE manual dari Admin/Temp Admin ditolak 403.
- Tombol shutter memakai ref lock dan UUID unik yang direservasi database: double-click/parallel request dengan ID sama tidak membuat dua Moment.
- JPEG kualitas 0.88, maksimal sisi 1920px/5MB. Dimensi berasal dari header JPEG yang divalidasi server. Foto menyimpan seluruh frame/aspect ratio kamera, **bukan crop dari bentuk preview**. Preview kamera depan mirrored; foto tersimpan unmirrored.
- Tracks dihentikan saat close, switch dan unmount, termasuk getUserMedia yang selesai terlambat/StrictMode. Kamera tetap terbuka setelah publish agar beberapa foto dapat diambil dalam satu sesi. Modal mendukung focus trap, Escape ketika tidak mengunggah, touch target 44px/72px, dan reduced motion.
- Shutter hanya terkunci saat satu frame sedang dibuat; maksimal lima upload dapat berjalan bersamaan. Preview terbaru terbang ke tray kanan atas dan menampilkan status upload/retry. Close tetap dinonaktifkan sampai upload selesai, sedangkan navigasi/unmount menghentikan kamera dan membatalkan request client.

## Lifetime, kegagalan, dan preview

Homepage menggunakan tumpukan maksimal tiga kartu putih 3:4 dengan jendela foto membulat. Kartu belakang menyebar kiri-kanan saat hover/focus dan tetap sedikit terbuka pada perangkat sentuh. Kamera memakai preview gelap membulat yang selaras dengan viewer. Keduanya menampilkan timestamp format `20:33 / 30.08.26` (WIB). Jam preview kamera diperbarui setiap pergantian menit lalu terkunci saat shutter; ISO UTC tersebut disimpan sebagai `captured_at`, terpisah dari waktu publish. Server memvalidasi format/waktu dengan toleransi jam perangkat 5 menit.

Foto lama tanpa timestamp shutter tetap NULL dan tampil memakai `created_at` sebagai fallback waktu publish; jangan menganggapnya waktu potret asli. Tidak ada backfill waktu palsu. Masa aktif tidak dihitung dari metadata client ini.

`created_at` ditetapkan oleh database ketika publish; `expires_at = created_at + interval '24 hours'`. Query aktif memakai **`status = 'published' AND expires_at > now()`**, bukan jam browser. Homepage memuat maksimal tiga Moment terbaru melalui komponen penghubung tanpa mengubah `MomentsSection.tsx`.

Daftar disegarkan saat fokus kembali, saat expiry terdekat, dan maksimal setiap menit. Preview diperiksa kembali setelah download untuk menolak Moment yang dihapus/expired. Empty viewfinder mempertahankan tinggi yang sama dengan stack agar layout tidak bergeser.

Upload dimulai sebagai `pending`, diterbitkan hanya setelah kedua file tersimpan. Kegagalan dibersihkan best-effort dan meninggalkan catatan `failed` untuk retry Owner, bukan foto rusak di homepage. Pending yang terputus terlihat sebagai pembersihan setelah dua menit. Respons publish yang terputus direkonsiliasi sebelum menghapus file agar foto yang sebenarnya berhasil tidak terhapus.

Delete menandai `deleting` terlebih dahulu, sehingga langsung hilang dari query publik; kemudian menghapus file, lalu record. Jika salah satu cleanup gagal, API mengembalikan error dan Owner bisa mencoba lagi. Catatan cleanup tidak ditampilkan sebagai Moment aktif. Tidak ada retry upload otomatis. Browser bisa tetap memiliki preview kecil yang sudah pernah diunduh; perubahan di tab homepage lain mengikuti refresh daftar (maksimal sekitar satu menit).

Expired tidak tampil sebagai aktif, tetapi file/record boleh tetap ada untuk maintenance nanti. Tidak ada cron baru.

## File baru

- `supabase-migration-moments.sql`: tabel, masa aktif dan private storage.
- `supabase-migration-moments-captured-at.sql`: timestamp shutter, tanpa mengubah lifetime atau mengarang waktu foto lama.
- `lib/moment-time.ts`: validasi timestamp dan format WIB yang sama di server/browser.
- `components/moments/MomentCardFrame.tsx`: frame luar, potongan foto, dan cetakan timestamp bersama untuk dashboard/homepage.
- `lib/moments.ts`: DTO, batas foto dan pembacaan JSON defensif.
- `lib/moments-image.ts`: validasi JPEG/dimensi/preview.
- `lib/moments-form.ts`: batas ukuran multipart termasuk chunked body.
- `lib/moments-server.ts`: session guard existing, Supabase server ber-timeout, query/DTO dan error JSON.
- `lib/moments-publish.ts`: reservasi, upload, publish, rekonsiliasi dan delete retryable.
- `lib/moment-camera.ts`: lifecycle stream dan capture satu frame.
- `app/api/admin/moments/route.ts`: POST upload.
- `app/api/owner/moments/route.ts`: GET pengelolaan Owner.
- `app/api/owner/moments/[id]/route.ts`: DELETE Owner-only.
- `app/api/moments/route.ts`: daftar preview publik aktif.
- `app/api/moments/[id]/preview/route.ts`: proxy tiny preview aktif, no-store.
- `components/admin/MomentCameraDialog.tsx`: composer kamera.
- `components/admin/MomentDashboardActions.tsx`: quick action, notifikasi dan daftar Owner.
- `components/home/useMoments.ts`: refresh data/expiry, tanpa shuffle atau perubahan layout.
- `components/home/LiveMomentsSection.tsx`: data real untuk presentasi existing.
- `scripts/test-moments-capture.cjs`: regression test offline.
- `MOMENTS-IMPLEMENTATION.md`: catatan setup dan pengujian ini.

## File existing diubah

- `app/admin/page.tsx`: tambah quick action sesuai role.
- `components/owner/OwnerDashboard.tsx`: tambah quick action/pengelolaan Owner.
- `components/home/HomepageData.tsx`: ganti pemanggilan Moments kosong dengan penghubung data, posisi sama.
- `app/globals.css`: stack Homepage memakai fan responsif dengan perilaku khusus pointer dan touch, tanpa dependency animasi tambahan.
- `scripts/test-moments-preview.cjs`: test posisi menggunakan nama penghubung baru.

Tidak ada dependency/config/auth/key/middleware/editor lain yang diubah.

## Validasi dan batas pengujian

- TypeScript dan production build divalidasi.
- Tes existing carousel (24), homepage Gallery (19), gallery focus (8), Moments preview (11), dan capture/API (26): **88 tes**.
- Tes offline mencakup Owner/Admin/Temp Admin, delete permission, duplicate shutter, upload success/failure, partial cleanup, expiry filter, private DTO, denied/missing/busy camera, switch/late stream cleanup, original aspect ratio dan empty/non-JSON response.
- Browser menggunakan fixture UI lokal dengan permission kamera **disimulasikan ditolak**, bukan mengaktifkan kamera fisik. Composer diperiksa pada 320×568, 375×667, 414×896, 768×1024 dan 1360×900: tanpa horizontal overflow, shutter terlihat, close mengembalikan fokus dan scroll halaman.
- Belum dilakukan: capture dengan hardware nyata, integrasi upload/delete ke Supabase setelah migration, dan verifikasi RLS/RPC pada database live. Tes SQL saat ini memeriksa migration dan perilaku backend dengan database mock, bukan menjalankan PostgreSQL live.

Checklist manual setelah migration: buka Owner/Admin/Temp Admin masing-masing; izinkan kamera; shutter sekali; pastikan satu Moment aktif; cek front/back di HP; Owner hapus dan pastikan preview hilang. Uji browser menolak izin dan buka/tutup beberapa kali untuk mengecek indikator kamera. Jangan mengubah jam perangkat untuk tes expiry: acuannya waktu database.

## Sengaja belum dibuat

Viewer original, sekali-lihat, anonymous viewer tracking, signed URL original dan cron cleanup expired. Tombol entry Moments existing tetap hanya menyediakan hook `onOpen`; belum membuka viewer.

UI hanya menyediakan jalur kamera. Browser/web server tidak dapat membuktikan bahwa bytes dari client yang dimodifikasi benar-benar diambil dari kamera saat itu; API membatasi session, tipe, byte size dan dimensi, bukan mengklaim camera attestation.

Kamera memerlukan secure context: **HTTPS**, atau `localhost` pada perangkat yang sama. Membuka `http://IP-komputer:3000` dari HP umumnya tidak mengaktifkan getUserMedia. Lihat [MDN getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia). Private bucket mengikuti [Supabase Storage access model](https://supabase.com/docs/guides/storage/buckets/fundamentals).
