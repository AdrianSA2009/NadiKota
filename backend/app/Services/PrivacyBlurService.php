<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * Sensor otomatis wajah & plat nomor kendaraan pada foto laporan.
 *
 * Deteksi kotak batas lewat model vision yang sama dengan validasi AI
 * (koordinat dinormalisasi 0..1), lalu di-blur memakai GD.
 * Foto tanpa privasi terdeteksi dikembalikan apa adanya (tanpa re-encode).
 */
final class PrivacyBlurService
{
    /**
     * @return array{0: string, 1: array<string, int>}|null [binary blur, jumlah area] atau null bila gagal total
     */
    public function blur(string $binary, string $mimeType): ?array
    {
        $boxes = $this->detect($binary, $mimeType);
        if ($boxes === []) {
            return [$binary, ['faces' => 0, 'plates' => 0]];
        }

        $image = @imagecreatefromstring($binary);
        if ($image === false) {
            return null;
        }

        $w = imagesx($image);
        $h = imagesy($image);
        $counts = ['faces' => 0, 'plates' => 0];

        foreach ($boxes as $box) {
            // Padding 12% sisi lebih besar agar menutup rambut/dagu &-placeholder plat.
            $padX = ($box['x2'] - $box['x1']) * 0.12;
            $padY = ($box['y2'] - $box['y1']) * 0.12;
            $x1 = max(0, (int) round(($box['x1'] - $padX) * $w));
            $y1 = max(0, (int) round(($box['y1'] - $padY) * $h));
            $x2 = min($w - 1, (int) round(($box['x2'] + $padX) * $w));
            $y2 = min($h - 1, (int) round(($box['y2'] + $padY) * $h));
            $bw = $x2 - $x1;
            $bh = $y2 - $y1;
            if ($bw < 4 || $bh < 4) {
                continue;
            }

            // Blur: crop → resize kecil → resize balik → overlay (efek pikselCMOS).
            $crop = imagecrop($image, ['x' => $x1, 'y' => $y1, 'width' => $bw, 'height' => $bh]);
            if ($crop === false) {
                continue;
            }
            $tiny = imagecreatetruecolor(max(1, (int) ($bw / 18)), max(1, (int) ($bh / 18)));
            imagecopyresampled($tiny, $crop, 0, 0, 0, 0, imagesx($tiny), imagesy($tiny), imagesx($crop), imagesy($crop));
            $back = imagecreatetruecolor($bw, $bh);
            imagecopyresampled($back, $tiny, 0, 0, 0, 0, $bw, $bh, imagesx($tiny), imagesy($tiny));
            imagecopy($image, $back, $x1, $y1, 0, 0, $bw, $bh);

            imagedestroy($crop);
            imagedestroy($tiny);
            imagedestroy($back);
            $counts[$box['kind']]++;
        }

        ob_start();
        imagejpeg($image, null, 85);
        $out = (string) ob_get_clean();
        imagedestroy($image);

        return [$out, $counts];
    }

    /**
     * Minta model vision locate wajah + plat.
     *
     * @return list<array{kind: string, x1: float, y1: float, x2: float, y2: float}>
     */
    private function detect(string $binary, string $mimeType): array
    {
        try {
            $baseUrl = rtrim((string) config('nadi-kota.ai.base_url'), '/');
            $apiKey = (string) config('services.openai.api_key', env('OPENAI_API_KEY'));

            $response = Http::withHeaders([
                'Authorization' => 'Bearer ' . $apiKey,
                'Content-Type' => 'application/json',
            ])
                // Retry 2x: provider AI kadang menolak payload sesaat (400) lalu bisa diulang.
                ->timeout((int) config('nadi-kota.ai.timeout_seconds', 20))
                ->retry(2, 800, throw: false)
                ->post($baseUrl . '/chat/completions', [
                    'model' => (string) config('nadi-kota.ai.model', 'gpt-4o-mini'),
                    'messages' => [[
                        'role' => 'user',
                        'content' => [
                            ['type' => 'text', 'text' => $this->prompt()],
                            ['type' => 'image_url', 'image_url' => [
                                'url' => 'data:' . $mimeType . ';base64,' . base64_encode($binary),
                                'detail' => 'high',
                            ]],
                        ],
                    ]],
                    'max_tokens' => 600,
                    'response_format' => ['type' => 'json_object'],
                ]);

            if (! $response->successful()) {
                throw new \RuntimeException('status ' . $response->status() . ': ' . substr($response->body(), 0, 300));
            }
            $content = (string) $response->json('choices.0.message.content', '{}');
            $data = json_decode($content, true);
            $items = is_array($data['privacy'] ?? null) ? $data['privacy'] : [];

            $boxes = [];
            foreach ($items as $item) {
                if (! is_array($item)) {
                    continue;
                }
                $kind = ($item['kind'] ?? '') === 'plate' ? 'plates' : 'faces';
                $box = [$item['x1'] ?? null, $item['y1'] ?? null, $item['x2'] ?? null, $item['y2'] ?? null];
                if (in_array(null, $box, true)) {
                    continue;
                }
                $boxes[] = [
                    'kind' => $kind,
                    'x1' => max(0.0, min(1.0, (float) $item['x1'])),
                    'y1' => max(0.0, min(1.0, (float) $item['y1'])),
                    'x2' => max(0.0, min(1.0, (float) $item['x2'])),
                    'y2' => max(0.0, min(1.0, (float) $item['y2'])),
                ];
            }

            return $boxes;
        } catch (\Throwable $e) {
            // Gagal deteksi → jangan blokir laporan; foto tetap terkirim seperti biasa.
            Log::warning('PrivacyBlur: deteksi gagal', ['error' => $e->getMessage(), 'bytes' => strlen($binary)]);

            return [];
        }
    }

    /**
     * Sensor foto yang sudah tersimpan di disk (laporan offline / jalur bypass screening).
     * Gagal atau tidak ada privasi → foto dibiarkan apa adanya.
     */
    public function redactStoredPhoto(string $objectKey): void
    {
        $disk = Storage::disk(config('filesystems.default'));
        $binary = $disk->get($objectKey);
        $result = $this->blur($binary, $this->guessMime($objectKey, $binary));
        if ($result !== null && $result[0] !== $binary) {
            $disk->put($objectKey, $result[0]);
        }
    }

    private function guessMime(string $objectKey, string $binary): string
    {
        $info = @getimagesizefromstring($binary);
        if (is_array($info) && isset($info['mime'])) {
            return (string) $info['mime'];
        }

        return str_ends_with(strtolower($objectKey), '.png') ? 'image/png' : 'image/jpeg';
    }

    private function prompt(): string
    {
        return <<<'PROMPT'
Temukan SEMUA privasi yang perlu disensor pada foto ini:
1. "face" — wajah manusia yang terlihat (termasuk wajah sebagian, samping, atau tertutup masker/topi).
2. "plate" — plat nomor kendaraan (mobil, motor, truk, bus) yang terbaca.

Kembalikan HANYA JSON dengan format:
{
  "privacy": [
    {"kind": "face"|"plate", "x1": 0.0-1.0, "y1": 0.0-1.0, "x2": 0.0-1.0, "y2": 0.0-1.0}
  ]
}

Semua koordinat dinormalisasi 0..1 relatif terhadap lebar/tinggi gambar (0 = kiri/atas, 1 = kanan/bawah).
Kotak harus snugaround objek yang disensor. Jika tidak ada wajah maupun plat sama sekali, kembalikan {"privacy": []}.
PROMPT;
    }
}