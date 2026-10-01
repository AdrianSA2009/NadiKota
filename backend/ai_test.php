<?php

// Test AI endpoint langsung: php backend/ai_test.php
require __DIR__ . '/vendor/autoload.php';
$app = require __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\Http;

try {
    // Uji vision: gambar JPEG kecil (1x1 pixel merah) sebagai proxy foto jalan
    $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');
    $r = Http::withHeaders(['Authorization' => 'Bearer ' . config('services.openai.api_key')])
        ->timeout(60)
        ->post(rtrim(config('nadi-kota.ai.base_url'), '/') . '/chat/completions', [
            'model' => config('nadi-kota.ai.model'),
            'messages' => [['role' => 'user', 'content' => [
                ['type' => 'text', 'text' => 'Kembalikan JSON: {"feasibility": "valid"|"invalid"|"uncertain", "category": "pothole"|"street_light"|"other", "severity": "low"|"moderate"|"high"|"critical", "confidence": 0.0-1.0, "reason": "singkat"}'],
                ['type' => 'image_url', 'image_url' => ['url' => 'data:image/png;base64,' . base64_encode($png), 'detail' => 'low']],
            ]]],
            'max_tokens' => 300,
            'response_format' => ['type' => 'json_object'],
        ]);
    echo 'HTTP ' . $r->status() . PHP_EOL;
    echo substr($r->body(), 0, 1500) . PHP_EOL;
} catch (\Throwable $e) {
    echo 'EXCEPTION: ' . $e->getMessage() . PHP_EOL;
}
