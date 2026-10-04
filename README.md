# NadiKota

Aplikasi pelaporan kerusakan infrastruktur kota (jalan berlubang, PJU mati) — warga melapor, AI memvalidasi, admin meninjau & menugaskan tim lapangan, tim mengerjakan & mengirim bukti, admin menyelesaikan.

## Stack

| Bagian | Teknologi |
|---|---|
| `backend/` | Laravel 11 · PHP 8.2 · PostgreSQL + PostGIS · Redis (cache/queue) · Sanctum (session) · Pest |
| `frontend/` | Next.js 16 (App Router, Turbopack) · React 19 · Tailwind CSS v4 · TanStack Query · zustand · ikon: `lucide-react` (outline) + `react-icons` (solid) |
| `mobile/` | Expo (React Native) · expo-router · MapLibre RN · TanStack Query |
| Peta | MapLibre GL · OSM · Nominatim/Photon (geocoding) · OSRM (rute) — tanpa API key |

## Peran

- **Citizen (warga)** — lapor kerusakan (foto + lokasi), pantau status, poin kontribusi.
- **Petugas Dinas** — tinjau tiket (setujui/tolak + tingkat bahaya), dispatch tim, nilai bukti hasil perbaikan, kelola tim & PJ, dashboard analitik.
- **Tim Lapangan** — "Tugas Saya": Mulai → kerjakan → kirim foto bukti.

## Alur Tiket

```
reported → needs_review → queued → in_progress → completed
                ▲              │          │
        (admin menyetujui)     │     bukti: submitted / proof_rejected
```

- AI (`ValidateReportImage`) memvalidasi foto laporan. Lolos AI **bukan** langsung antre — tiket tetap `needs_review` sampai admin menyetujui; selain itu `suspicious`/lokasi mencurigakan/gagal juga masuk `needs_review`, `rejected` → warga dapat umpan balik.
- Dispatch hanya menyetor tim (status tetap `queued` + `assigned_team_id`) — tim menekan **Mulai** untuk `in_progress`.
- PJ terkunci selama ada tiket `in_progress`; nama PJ pelaksana di-snapshot ke tiket (`tickets.assignee_name`).

## Menjalankan

> **Catatan monorepo:** root repo bukan package npm — `npm install`/`composer install` dijalankan di dalam subfolder (`frontend/`, `backend/`). Instalasi di root hanya menghasilkan `package.json` sampah.

### 1. Infrastruktur (Docker)

```bash
cd backend
docker compose up -d postgres redis   # PostGIS + Redis
```

### 2. Backend

```bash
cd backend
composer install
cp .env.example .env                  # sesuaikan kredensial
php artisan key:generate
php artisan migrate
php artisan serve                     # http://localhost:8000
php artisan queue:work redis --queue=ai-validation,notifications,default
php artisan schedule:work              # WAJIB: recompute prioritas harian + eskalasi SLA
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev                           # http://localhost:3000 (proxy /api → :8000)
```

### 4. Mobile (opsional)

```bash
cd mobile
npm install
npx expo start
```

## Konfigurasi Penting (`backend/.env`)

| Variabel | Keterangan |
|---|---|
| `DB_*` / `REDIS_*` | PostGIS `nadi_kota` + Redis (lihat `backend/docker-compose.yml`) |
| `FILESYSTEM_DISK` | `s3` untuk foto (atau ganti `public` untuk lokal) |
| `QUEUE_CONNECTION=redis` | Wajib — validasi AI & notifikasi jalan via antrian |
| `MAIL_*` | SMTP Gmail untuk OTP registrasi (isi `MAIL_USERNAME` + **App Password**) |

Konfigurasi model AI, radius klaster, poin, rate-limit, dan SLA per kategori ada di `backend/config/nadi-kota.php`.

### Proses latar yang wajib berjalan

Dua terminal terpisah (atau systemd/pm2 di server):

```bash
# 1. Antrean kerja — validasi AI, screening foto, notifikasi
php artisan queue:work redis --queue=ai-validation,notifications,default

# 2. Penjadwalan — recompute prioritas harian + eskalasi SLA (nadi:escalate-overdue)
php artisan schedule:work
```

Di produksi, `schedule:work` digantikan cron per menit:

```
* * * * * cd /path/backend && php artisan schedule:run >> /dev/null 2>&1
```

## Alur Otomatis (background job)

| Job | Kapan | Fungsi |
|---|---|---|
| `ScreenReportPhoto` | warga ambil foto | screening AI (kategori/keparahan) + **sensor wajah & plat** |
| `ValidateReportImage` | laporan masuk | validasi AI final → tiket `needs_review` (tunggu tinjauan admin) |
| `SendTicketNotification` / `SendRoleNotification` | perubahan status | notifikasi warga & badge admin/tim |
| `EscalateOverdueTickets` | harian (`schedule`) | eskalasi SLA berjenjang ke atasan |
| `RedactLegacyPhotos` | manual (`--id` opsional) | sensor ulang foto lama (sebelum fitur privasi) |

## Testing & Gate

```bash
cd backend
php artisan test          # Pest — feature & unit

cd frontend
npx eslint components lib app   # lint sebelum commit
npx tsc --noEmit                # type-check
```

## Peta & Navigasi

- `/peta` — marker tiket (warna = tingkat bahaya), pencarian tempat (Photon), rute (OSRM), reverse geocoding (Nominatim).
- **Peringatan suara jalan berlubang**: saat menempuh rute, lubang ≤50 m dari rute diucapkan lewat Web Speech API (voice Microsoft id-ID) ketika pengguna berada dalam 50 m — sekali per lubang per rute.

## Notifikasi

Badge merah per tab menu (polling 30 detik), dibuat backend via `SendRoleNotification`:

- Tiket baru → tab **Tiket** (admin)
- Bukti perbaikan dikirim → tab **Review** (admin)
- Tiket didispatc ke tim → tab **Tugas Saya** (tim lapangan)

Membuka tab menandai notifikasi tipe tsb sudah dibaca.

## Struktur Repo

```
backend/    Laravel API (app/Http/Controllers/Api/V1, Services, Jobs)
frontend/   Next.js web (app/(citizen), app/(staff), components/)
mobile/     Aplikasi Expo
```

## Logo

Semua aset logo ada di `frontend/public/`:

| File | Untuk |
|---|---|
| `logo-mark.svg` | Ikon saja (avatar, watermark) |
| `logo-horizontal.svg` | Logo + wordmark — header web, email, presentasi |
| `logo-512.svg` / `.png` | 512×512 — avatar Gmail, maskable PWA |
| `logo-192.png` / `logo-180.png` | PWA & apple-touch-icon |
| `logo-favicon.svg` + `favicon-32.png` + `favicon.ico` | Favicon (16/32/48) |

**Regenerasi PNG dari SVG** (butuh [ImageMagick](https://imagemagick.org)):

```powershell
cd frontend/public
magick -background none logo-512.svg -resize 512x512 logo-512.png
magick -background none logo-512.svg -resize 192x192 logo-192.png
magick -background none logo-512.svg -resize 180x180 logo-180.png
magick -background none logo-favicon.svg -resize 32x32 favicon-32.png
magick -background none logo-favicon.svg -define icon:auto-resize=48,32,16 favicon.ico
```

API terdokumentasi di `backend/docs/openapi.yaml`. Spesifikasi & desain proyek disimpan terpisah (PRD, SAD, Frontend/Backend Design).

## Lisensi

Lihat [LICENSE](LICENSE).