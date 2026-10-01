<?php

// Test deteksi rephoto: buat gambar mirip screenshot UI, lalu jalankan ScreenReportPhoto.
// php backend/rephoto_test.php
require __DIR__ . '/vendor/autoload.php';
$app = require __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Jobs\ScreenReportPhoto;
use Illuminate\Support\Facades\Storage;

$w = 750; $h = 850;
$im = imagecreatetruecolor($w, $h);
// Latar foto layar HP: tampilan artikel dengan foto lubang
$bg = imagecolorallocate($im, 245, 245, 245);
imagefill($im, 0, 0, $bg);

// Bar navigasi atas (tombol kembali + logo aplikasi) — tiru kasus nyata
$nav = imagecolorallocate($im, 255, 255, 255);
imagefilledrectangle($im, 0, 0, $w, 70, $nav);
$red = imagecolorallocate($im, 200, 40, 40);
imagefilledellipse($im, 75, 35, 44, 44, $red);
imagestring($im, 5, 40, 28, '<', imagecolorallocate($im, 60, 60, 60));
imagestring($im, 5, 120, 28, 'Auto2000 Digital', imagecolorallocate($im, 30, 30, 30));

// Area foto lubang (simulasi konten artikel)
$road = imagecolorallocate($im, 150, 150, 145);
imagefilledrectangle($im, 20, 90, $w - 20, 640, $road);
$hole = imagecolorallocate($im, 70, 70, 70);
imagefilledellipse($im, 375, 380, 300, 190, $hole);
$crack = imagecolorallocate($im, 95, 95, 90);
for ($i = 0; $i < 12; $i++) {
    imageline($im, 60 + $i * 55, 100, 130 + $i * 50, 630, $crack);
}

// Caption artikel di bawah foto
imagefilledrectangle($im, 0, 650, $w, 730, $nav);
imagestring($im, 5, 30, 665, '8 Tips Aman Mengemudi Jalan', imagecolorallocate($im, 30, 30, 30));
imagestring($im, 3, 30, 700, 'Baca selengkapnya di blog otomotif...', imagecolorallocate($im, 110, 110, 110));

// Ikon lingkaran kiri-bawah (UI aplikasi)
imagefilledellipse($im, 60, 790, 70, 70, imagecolorallocate($im, 30, 30, 30));

// Grid halus (moiré layar)
$light = imagecolorallocate($im, 225, 225, 225);
for ($x = 0; $x < $w; $x += 8) imageline($im, $x, 90, $x, 640, $light);
for ($y = 90; $y < 640; $y += 8) imageline($im, 20, $y, $w - 20, $y, $light);

ob_start();
imagepng($im);
$png = ob_get_clean();
imagedestroy($im);

$path = 'photos/screening/rephoto-test.png';
Storage::disk(config('filesystems.default'))->put($path, $png);

$checkId = (string) Illuminate\Support\Str::uuid();
ScreenReportPhoto::dispatch($checkId, $path, 'image/png')->onQueue('ai-validation');

$result = null;
for ($i = 0; $i < 45; $i++) {
    usleep(1_000_000);
    $result = Illuminate\Support\Facades\Cache::get(ScreenReportPhoto::cacheKey($checkId));
    if ($result && $result['status'] !== 'pending') break;
}

var_export($result);
echo "\n";
