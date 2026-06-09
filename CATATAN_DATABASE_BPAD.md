# Catatan Database BPAD

Database Supabase ini juga dipakai oleh project web BPAD. Aplikasi absensi apel pagi harus dianggap sebagai modul terpisah dan tidak boleh mengubah, menghapus, atau membuka akses tabel milik website BPAD.

## Aturan Utama

1. Semua tabel milik absensi wajib memakai prefix `absen_`.
2. Script SQL absensi hanya boleh menyentuh tabel dengan prefix `public.absen_`.
3. Jangan membuat policy `anon_all` untuk tabel web BPAD.
4. Jangan menjalankan `drop table`, `truncate`, atau `delete` tanpa filter tanggal/scope yang jelas.
5. Jangan memakai nama tabel generik seperti `daily_reports`, `attendance_records`, `settings`, atau `users` karena mudah bentrok dengan project lain.
6. Service role key hanya boleh disimpan di GitHub Secrets atau environment lokal, tidak boleh masuk source code.
7. Setiap perubahan SQL untuk absensi harus dicek dulu dengan pencarian `absen_` agar tidak ada tabel web BPAD yang ikut tersentuh.

## Tabel Absensi Saat Ini

- `public.absen_attendance_records`
- `public.absen_daily_reports`
- `public.absen_system_heartbeat`

Kalau nanti ada tabel baru untuk absensi, ikuti pola ini:

```sql
public.absen_nama_tabel
```

Contoh aman:

```sql
public.absen_users
public.absen_admin_accounts
public.absen_audit_logs
```

Contoh yang harus dihindari:

```sql
public.users
public.settings
public.daily_reports
public.attendance_records
```

## Trik Paling Aman

Pilihan paling rapi untuk jangka panjang adalah membuat schema khusus `absensi`, misalnya:

```sql
absensi.attendance_records
absensi.daily_reports
absensi.admin_accounts
```

Keuntungannya:

1. Tabel absensi benar-benar terpisah dari tabel website BPAD.
2. Policy RLS bisa dibuat khusus untuk schema absensi.
3. Lebih kecil risiko salah query ke tabel web.
4. Nanti kalau app absensi berkembang, struktur database tetap bersih.

Catatan: jika memakai schema `absensi`, schema tersebut perlu ditambahkan ke exposed schemas di Supabase API settings, dan kode frontend perlu diarahkan ke schema itu. Untuk kondisi sekarang yang sudah berjalan, prefix `absen_` masih aman selama aturan di atas disiplin dipakai.

## Mode Akses Saat Ini

Saat ini app absensi masih memakai anon key dari frontend. Karena itu policy sementara membuka akses ke tabel `absen_*` agar aplikasi GitHub Pages bisa simpan data.

Ini aman untuk operasional cepat, tetapi belum ideal untuk jangka panjang. Target berikutnya:

1. Pakai Supabase Auth untuk akun admin badan dan admin bidang.
2. Tutup akses `anon` untuk insert/update/delete.
3. Buka CRUD hanya untuk role `authenticated`.
4. Tambahkan policy scope supaya admin bidang hanya bisa input bidangnya sendiri.
5. Simpan audit log untuk catatan siapa yang simpan, hapus, atau ubah data.

## Checklist Sebelum Menjalankan SQL

Sebelum menjalankan script SQL untuk absensi, cek hal ini:

1. Script hanya mengandung tabel `absen_*`.
2. Tidak ada nama tabel web BPAD yang ikut disebut.
3. Tidak ada `drop table` kecuali benar-benar disengaja dan sudah backup.
4. Tidak ada `grant all on schema public` yang terlalu luas.
5. Jika policy membuka `anon`, pastikan hanya untuk tabel `absen_*`.
6. Setelah eksekusi, uji endpoint `absen_daily_reports` dan `absen_attendance_records`.

## Prinsip Kerja

Anggap database seperti satu kantor yang dipakai dua bidang. Absensi boleh punya ruangan sendiri, kunci sendiri, dan arsip sendiri. Jangan pindahkan lemari website BPAD hanya karena absensi butuh tempat tambahan.
