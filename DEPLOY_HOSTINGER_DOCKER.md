# Deploy Docker di Hostinger VPS

Panduan ini untuk deploy aplikasi Absensi Apel Pagi BPAD sebagai static site memakai Docker + Nginx.

## File Docker

- `Dockerfile`
- `docker-compose.yml`
- `nginx.conf`
- `.env.example`
- `docker-entrypoint.d/10-supabase-config.sh`

## Catatan Database

Database Supabase juga dipakai oleh web BPAD. Deploy Docker ini hanya menjalankan frontend absensi dan hanya memakai tabel dengan prefix `absen_`.

Jangan masukkan `SUPABASE_SERVICE_ROLE_KEY` ke container frontend. Container ini hanya butuh:

```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
```

## Deploy Pertama di VPS

Masuk ke VPS:

```bash
ssh root@IP_VPS
```

Install Docker:

```bash
apt update
apt install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sh
apt install -y docker-compose-plugin
```

Ambil repo:

```bash
mkdir -p /opt
cd /opt
git clone https://github.com/ihsanmokhsen/V3-absen-html.git bpad-absensi
cd bpad-absensi
```

Buat file environment:

```bash
cp .env.example .env
nano .env
```

Isi `.env`:

```env
SUPABASE_URL=https://ndnvmtilzzsbacncbiqi.supabase.co
SUPABASE_ANON_KEY=ISI_DENGAN_ANON_KEY_ATAU_PUBLISHABLE_KEY
```

Jalankan container:

```bash
docker compose up -d --build
```

Cek status:

```bash
docker compose ps
docker compose logs -f
```

Buka:

```text
http://IP_VPS:8080
```

## Jika VPS Khusus Untuk Aplikasi Ini

Ubah port di `docker-compose.yml`:

```yaml
ports:
  - "80:80"
```

Lalu jalankan ulang:

```bash
docker compose up -d --build
```

Buka:

```text
http://IP_VPS
```

## Update Setelah Push GitHub

Di VPS:

```bash
cd /opt/bpad-absensi
git pull origin main
docker compose up -d --build
```

## Domain dan HTTPS

Jika memakai domain, arahkan DNS `A record` ke IP VPS. Setelah itu pasang reverse proxy atau Nginx host di VPS untuk meneruskan domain ke container port `8080`.

Untuk production, aktifkan HTTPS memakai Certbot atau reverse proxy yang otomatis mengurus SSL.

## Troubleshooting Cepat

Jika aplikasi terbuka tapi tidak bisa simpan ke Supabase:

```bash
docker compose logs -f
```

Cek file config runtime:

```bash
docker exec -it bpad-absensi cat /usr/share/nginx/html/supabase.local.js
```

Jika `SUPABASE_URL` atau `SUPABASE_ANON_KEY` kosong, perbaiki `.env`, lalu jalankan ulang:

```bash
docker compose up -d --build
```
