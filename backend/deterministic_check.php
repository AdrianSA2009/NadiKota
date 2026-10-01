<?php

// php backend/deterministic_check.php
require __DIR__ . '/vendor/autoload.php';
$app = require __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$w = 430; $h = 430;
$im = imagecreatetruecolor($w, $h);
$phone = imagecolorallocate($im, 18, 18, 18);
imagefill($im, 0, 0, $phone);
imagefilledrectangle($im, 18, 18, 411, 411, imagecolorallocate($im, 120, 118, 112));
// content image (pothole-like) and moire pattern
imagefilledellipse($im, 215, 225, 220, 130, imagecolorallocate($im, 65, 65, 60));
for ($x = 18; $x < 412; $x += 6) imageline($im, $x, 18, $x, 411, imagecolorallocate($im, 115, 113, 108));
ob_start(); imagejpeg($im, null, 90); $contents = ob_get_clean(); imagedestroy($im);
$result = app(App\Services\RecapturedPhotoDetector::class)->inspect($contents, 'image/jpeg');
var_export($result); echo "\n";
