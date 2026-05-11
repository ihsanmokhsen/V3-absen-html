# Setup Supabase (Secure-First)

## Status Keamanan Saat Ini
- Source code **tidak** menyimpan URL/key Supabase hardcoded.
- File rahasia lokal dipisahkan ke `supabase.local.js` (di-ignore oleh git).
- SQL utama (`supabase-schema.sql`) default-nya **aman**: akses `anon` ditutup.

## 1) Siapkan kredensial secara lokal (tidak masuk GitHub)
1. Copy file `supabase.local.example.js` menjadi `supabase.local.js`.
2. Isi:
- `url`
- `anonKey` (publishable key)
3. `supabase.local.js` sudah ada di `.gitignore`, jadi tidak akan ter-push.

## 2) Jalankan SQL schema aman
1. Buka Supabase Dashboard -> SQL Editor.
2. Jalankan `supabase-schema.sql`.

Catatan:
- Dengan schema aman ini, frontend perlu session `authenticated` supaya bisa baca/tulis.
- Jika app belum pakai Supabase Auth, sync akan ditolak (ini normal, demi keamanan).

## 3) (Opsional) Mode development cepat - tidak aman
- Jika kamu butuh uji cepat tanpa auth, jalankan `supabase-dev-open-policies.sql`.
- File ini membuka akses `anon` (CRUD), **jangan dipakai produksi**.

## 4) Rekomendasi sebelum deploy publik
1. Pakai Supabase Auth untuk admin bidang.
2. Pertahankan policy hanya `authenticated`.
3. Jangan pernah commit service role key.

## 5) Keepalive otomatis agar project tidak cepat pause
File yang disiapkan:
- `.github/workflows/supabase-keepalive.yml`
- `supabase-keepalive.sql`

Langkah:
1. Jalankan `supabase-keepalive.sql` di SQL Editor Supabase.
2. Di GitHub repo, buka `Settings -> Secrets and variables -> Actions`.
3. Tambah secrets:
- `SUPABASE_URL` = URL project Supabase kamu
- `SUPABASE_SERVICE_ROLE_KEY` = service role key (jangan pernah commit)
4. Workflow akan jalan otomatis tiap 2 hari (`15 0 */2 * *`, UTC) dan update tabel `system_heartbeat`.

Catatan:
- Scheduler GitHub Actions berjalan di branch default.
- Kalau repo lama tidak ada aktivitas, GitHub bisa menonaktifkan scheduled workflow; sesekali cek tab Actions.

## 6) Supabase saat deploy GitHub Pages
Agar aplikasi deployed bisa menulis ke database, set secret ini di GitHub repo:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` (publishable/anon key, bukan service role)

Workflow `Deploy GitHub Pages` akan membuat `supabase.local.js` otomatis dari secret tersebut saat build.
Jika secret belum lengkap, workflow sekarang akan `fail` agar tidak sukses palsu dengan config kosong.
