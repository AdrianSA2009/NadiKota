<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * Generate deskripsi hadiah memakai AI.
 */
final class RewardDescriptionGenerator
{
    public function generate(string $name): string
    {
        $baseUrl = rtrim((string) config('nadi-kota.ai.base_url'), '/');
        $apiKey = (string) (config('services.openai.api_key') ?? '');

        $prompt = "Buatkan deskripsi singkat (maksimal 150 karakter) untuk hadiah bernama \"{$name}\". "
            . "Deskripsi harus menarik, informatif, dan dalam bahasa Indonesia. "
            . "Fokus pada manfaat atau nilai hadiah. "
            . "Balas hanya JSON {\"description\":\"...\"}";

        try {
            $response = Http::withHeaders([
                'Authorization' => 'Bearer ' . $apiKey,
                'Content-Type' => 'application/json',
            ])->timeout(10)->post($baseUrl . '/chat/completions', [
                'model' => config('nadi-kota.ai.model'),
                'messages' => [['role' => 'user', 'content' => $prompt]],
                'max_tokens' => 80,
                'response_format' => ['type' => 'json_object'],
            ]);
            $response->throw();

            $data = json_decode((string) $response->json('choices.0.message.content', '{}'), true);
            $description = is_array($data) ? trim((string) ($data['description'] ?? '')) : '';

            return $description !== '' ? $description : '';
        } catch (Throwable $e) {
            \Log::error('Failed to generate reward description', ['error' => $e->getMessage()]);
            return '';
        }
    }
}
