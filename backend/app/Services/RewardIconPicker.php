<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * Pilih ikon hadiah (nama komponen lucide-react) memakai AI.
 * Gagal/timeout → 'Gift'.
 *
 * ponytail: dipanggil sinkron saat admin membuat hadiah — pindah ke queue
 * kalau respons AI makin lambat.
 */
final class RewardIconPicker
{
    /** Harus identik dengan frontend/lib/rewardIcons.tsx */
    public const ICONS = [
        'BookOpen', 'Bus', 'Car', 'Coins', 'CreditCard', 'Droplets', 'Fuel',
        'Gift', 'Heart', 'Leaf', 'Lightbulb', 'Package', 'Phone', 'Recycle',
        'ShieldCheck', 'ShoppingBag', 'Smartphone', 'Sprout', 'Ticket',
        'Train', 'Utensils', 'Wallet', 'Zap',
    ];

    public function pick(string $name, ?string $description = null): string
    {
        $baseUrl = rtrim((string) config('nadi-kota.ai.base_url'), '/');
        $apiKey = (string) (config('services.openai.api_key') ?? '');

        $prompt = "Nama hadiah penukaran poin: {$name}\n"
            . ($description !== null && $description !== '' ? "Deskripsi: {$description}\n" : '')
            . 'Pilih SATU ikon yang paling mewakili dari daftar: ' . implode(', ', self::ICONS) . "\n"
            . 'Balas hanya JSON {"icon":"NamaIkon"}.';

        try {
            $response = Http::withHeaders([
                'Authorization' => 'Bearer ' . $apiKey,
                'Content-Type' => 'application/json',
            ])->timeout(10)->post($baseUrl . '/chat/completions', [
                'model' => config('nadi-kota.ai.model'),
                'messages' => [['role' => 'user', 'content' => $prompt]],
                'max_tokens' => 30,
                'response_format' => ['type' => 'json_object'],
            ]);
            $response->throw();

            $data = json_decode((string) $response->json('choices.0.message.content', '{}'), true);
            $icon = is_array($data) ? (string) ($data['icon'] ?? '') : '';

            return in_array($icon, self::ICONS, true) ? $icon : 'Gift';
        } catch (Throwable) {
            return 'Gift';
        }
    }
}
