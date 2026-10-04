# Skrip Video Demo NadiKota

Rekaman layar alur penuh: **register → lapor jalan berlubang → review admin → dispatch → tim lapangan kerja & kirim bukti → admin finalisasi**. Semua label tombol di bawah diambil langsung dari kode (lihat "Sumber" tiap scene).

- **Target durasi:** ±3 menit (bisa dipotong jadi 90 detik untuk pitch).
- **Format:** rekaman layar 1080p30, zoom in 125–150% pada area klik, cursor highlight.
- **Total satu kali take** dengan beberapa window: warga, admin, tim lapangan.

---

## Persiapan SEBELUM rekam (wajib)

| # | Cek | Kenapa |
|---|---|---|
| 1 | Docker postgres + redis jalan; `php artisan serve`; frontend `npm run dev` | Aplikasi hidup |
| 2 | **Queue worker jalan:** `php artisan queue:work redis --queue=ai-validation,notifications,default` | Tanpa worker laporan tetap `reported` → status "Dalam tinjauan" tidak pernah muncul di video |
| 3 | `php artisan schedule:work` (opsional utk demo) | Hanya untuk menunjukkan prioritas/SLA harian |
| 4 | Siapkan **3 sesi browser terpisah** (Profile: Warga, Admin, Tim) | Ganti peran cepat tanpa logout/login di tengah rekaman |
| 5 | Admin & field_team **sudah punya akun** + 1 tim dengan PJ aktif | Register hanya membuat akun citizen; tim harus sudah siap untuk dispatch |
| 6 | Email inbox terbuka (tab lain) untuk **OTP registrasi** | Alur daftar minta kode 6 digit |
| 7 | Siapkan 2 foto: **foto lubang jalan** (untuk lapor) & **foto perbaikan** (untuk bukti) — beda gambar | Bukti "sesudah" harus beda dari "sebelum" |
| 8 | Lokasi demo: titik di dalam Batam (bounding box `nadi-kota.geo`) | Koordinat di luar Batam bisa masuk needs_review/geospasial aneh |

> Catatan: screening/AI memakai endpoint `OPENAI_BASE_URL`. Kalau provider lambat, rekam ulang scene 2 — jangan tampilkan layar loading lama.

---

## SCENE 1 — Registrasi warga (±30 detik)

**Layar:** `/login` · **Sumber:** `frontend/components/auth/LoginModal.tsx`

| Beat | Aksi di layar | Narasi (VO) / teks on-screen |
|---|---|---|
| 1.1 | Klik link **"Belum punya akun? Daftar"** | "Warga mendaftar dalam satu menit." |
| 1.2 | Isi Username, Nama lengkap, Email, Password, Konfirmasi password → klik **"Daftar"** | (biarkan form terisi cepat / jump-cut) "Data dasar, tanpa formulir panjang." |
| 1.3 | Pindah ke inbox email → salin **kode 6 digit** → kembali, isi "Kode verifikasi" → klik **"Verifikasi & Daftar"** | "Verifikasi email lewat OTP." |
| 1.4 | Berhasil → mendarat di **`/peta`** | "Akun siap. Peta langsung terbuka." |

**Editing:** boleh sembunyikan isi email/OTP (blur). Jangan tampilkan password.

---

## SCENE 2 — Laporan jalan berlubang (±45 detik)

**Layar:** `/peta` → `/report` · **Sumber:** `frontend/app/(citizen)/report/page.tsx`, `components/report/`

| Beat | Aksi di layar | VO / teks |
|---|---|---|
| 2.1 | Di peta, klik tombol **"Lapor" / "Lapor Kerusakan"** | "Lapor kerusakan langsung dari peta." |
| 2.2 | Langkah 1 — ambil/pilih foto lubang jalan; tunggu indikator screening (badge AI) muncul | "Foto diperiksa otomatis sebelum dikirim." |
| 2.3 | Langkah 2 — pilih titik di peta (GPS aktif), pilih kategori **"Jalan berlubang"** | "Lokasi dan kategori." |
| 2.4 | Langkah 3 — tinjau ringkasan → klik **"Kirim laporan"** | "Konfirmasi, lalu kirim." |
| 2.5 | Kembali ke peta → buka panel **Kontribusi** → tunjukkan kartu laporan muncul | "Laporan tercatat dan dipantau." |
| 2.6 | Refresh/menunggu → status berubah jadi **"Dalam tinjauan"** (strip `bg-info-600`) | "Sistem sedang memvalidasi." |

**Catatan produksi:** kalau status belum berubah, worker kemungkinan mati — cek dulu sebelum lanjut. Boleh jump-cut beberapa detik.

---

## SCENE 3 — Admin review tiket (±25 detik)

**Layar:** session Admin → `/review` · **Sumber:** `frontend/app/(staff)/review/page.tsx`

| Beat | Aksi di layar | VO / teks |
|---|---|---|
| 3.1 | (Jump-cut) ganti ke sesi admin → buka **Review** | "Petugas meninjau laporan masuk." |
| 3.2 | Buka tiket → lihat foto, lokasi, kategori | "Foto dan lokasi diperiksa." |
| 3.3 | Klik **"Setujui"** | "Disetujui → masuk antrean perbaikan." |

**Alternatif jalur (opsional, 5 detik):** tombol **"Tolak"** untuk menunjukkan human-in-the-loop — hanya jika waktu mengizinkan.

---

## SCENE 4 — Dispatch ke tim (±25 detik)

**Layar:** session Admin → `/dispatch` · **Sumber:** `frontend/app/(staff)/dispatch/page.tsx`, `components/dispatch/AssignTicket.tsx`

| Beat | Aksi di layar | VO / teks |
|---|---|---|
| 4.1 | Buka menu **Dispatch** → pilih tiket (status `queued`) | "Tiket ditugaskan ke tim terkait." |
| 4.2 | Cari/pilih tim di TeamPicker → **"Dipilih: &lt;nama tim&gt;"** | "Pilih tim lapangan." |
| 4.3 | Klik **"Tugaskan tim"** / **"Konfirmasi tugaskan"** → toast *"Tiket ditugaskan ke …"* | "Penugasan tercatat, SLA berjalan." |

---

## SCENE 5 — Tim lapangan mengerjakan & kirim bukti (±40 detik)

**Layar:** session field_team (PJ tim) → `/teams` tab **"Tugas saya"** · **Sumber:** `frontend/app/(citizen)/teams/page.tsx`

| Beat | Aksi di layar | VO / teks |
|---|---|---|
| 5.1 | (Jump-cut) login tim → menu menampilkan **"Tugas saya"** | "Tim melihat tugasnya." |
| 5.2 | Klik **"Mulai"** pada tiket → status jadi `in_progress` | "Pekerjaan dimulai di lokasi." |
| 5.3 | Klik **"Pilih foto bukti"** → pilih foto perbaikan | "Kirim bukti sesudah dikerjakan." |
| 5.4 | Klik **"Selesai"** → toast *"Bukti terkirim — menunggu verifikasi admin."* → badge **"Dalam Penilaian"** | "Bukti menunggu verifikasi." |

**Alternatif:** halaman `/teams/[id]/tasks` (CameraCapture inline + tombol "Selesai") — pilih salah satu, jangan keduanya supaya video tidak membingungkan.

---

## SCENE 6 — Admin konfirmasi hasil (±30 detik)

**Layar:** session Admin → `/tickets` → detail warga · **Sumber:** `frontend/app/(staff)/tickets/page.tsx`

| Beat | Aksi di layar | VO / teks |
|---|---|---|
| 6.1 | Kembali ke admin → **Tiket** → kartu berinfo *"Tim sudah mengirim bukti — periksa hasilnya, lalu Selesaikan atau Tolak."* | "Admin memverifikasi hasil." |
| 6.2 | Klik **"Cek hasilnya"** → bandingkan foto sebelum/sesudah | "Bukti dibandingkan dengan laporan awal." |
| 6.3 | Klik **"Selesai"** → status `completed` | "Perbaikan selesai dan disetujui." |
| 6.4 | (Jump-cut) kembali ke sesi warga → buka **detail tiket** → timeline penuh + foto sebelum/sesudah | "Warga melihat hasil akhirnya." |
| 6.5 | (Opsional) panel Kontribusi → lihat poin bertambah | "Setiap laporan yang selesai menghasilkan poin." |

**Alternatif 6 detik (human-in-the-loop):** ganti 6.3 dengan **"Tolak"** → modal *"Tolak bukti hasil?"* → tim kirim ulang — hanya jika target video ingin menonjolkan pengawasan mutu.

---

## Struktur editing yang disarankan

```
0:00  Opening — logo + tagline (2 detik)
0:02  SCENE 1  Registrasi + OTP
0:32  SCENE 2  Laporan (foto → lokasi → kirim → status)
1:17  SCENE 3  Admin review
1:42  SCENE 4  Dispatch
2:07  SCENE 5  Tim lapangan
2:47  SCENE 6  Finalisasi + hasil warga
3:17  Closing — ringkasan alur (teks: Warga → AI → Dinas → Tim → Selesai)
```

- Sisipkan **papan judul** antar scene (nama scene + peran aktif), durasi 1 detik.
- Highlight klik (kotak/ripple) pada tombol utama tiap scene.
- Musik latar rendah; VO bisa diganti teks on-screen bila tanpa suara.

## Checklist akhir sebelum take

- [ ] Worker queue aktif (cek status tiket berubah otomatis ke `needs_review`)
- [ ] 3 sesi browser siap (warga/admin/tim), semua sudah login
- [ ] Inbox email OTP terbuka
- [ ] 2 foto berbeda siap (sebelum/sesudah)
- [ ] Lokasi demo di dalam Batam
- [ ] Notifikasi system dimatikan (popup OS/browser)
- [ ] Tidak ada kredensial/OTP yang terekam tanpa blur
