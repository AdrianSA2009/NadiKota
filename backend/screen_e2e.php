<?php

// E2E test job ScreenReportPhoto: php backend/screen_e2e.php
require __DIR__ . '/vendor/autoload.php';
$app = require __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Jobs\ScreenReportPhoto;
use Illuminate\Support\Facades\Storage;

$png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');
$path = 'photos/screening/e2e-test.png';
Storage::disk(config('filesystems.default'))->put($path, $png);

$checkId = (string) Illuminate\Support\Str::uuid();

// Via queue Redis sungguhan (diverifikasi worker)
ScreenReportPhoto::dispatch($checkId, $path, 'image/png')->onQueue('ai-validation');

$start = microtime(true);
$result = null;
for ($i = 0; $i < 45; $i++) {
    usleep(1_000_000);
    $result = Illuminate\Support\Facades\Cache::get(ScreenReportPhoto::cacheKey($checkId));
    if ($result && $result['status'] !== 'pending') break;
}

echo 'elapsed: ' . round(microtime(true) - $start, 2) . "s\n";
var_export($result);
echo "\nphoto deleted: " . var_export(!Storage::disk(config('filesystems.default'))->exists($path), true) . "\n";
