<?php

namespace App\Services;

use App\Models\Photo;
use App\Services\Contracts\AiImageValidator;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class OpenAiImageValidator implements AiImageValidator
{
    public function validate(Photo $photo): array
    {
        $model = config('nadi-kota.ai.model', 'gpt-4o-mini');
        $timeout = config('nadi-kota.ai.timeout_seconds', 20);
        $promptVersion = config('nadi-kota.ai.prompt_version', 'v1.0');
        $apiKey = config('services.openai.api_key', config('OPENAI_API_KEY'));

        $imageContent = $this->getBase64Image($photo);
        $prompt = $this->buildPrompt();

        $response = Http::withHeaders([
            'Authorization' => 'Bearer ' . $apiKey,
            'Content-Type' => 'application/json',
        ])->timeout($timeout)->post('https://api.openai.com/v1/chat/completions', [
            'model' => $model,
            'messages' => [
                [
                    'role' => 'user',
                    'content' => [
                        ['type' => 'text', 'text' => $prompt],
                        [
                            'type' => 'image_url',
                            'image_url' => [
                                'url' => 'data:' . $photo->mime_type . ';base64,' . $imageContent,
                                'detail' => 'low',
                            ],
                        ],
                    ],
                ],
            ],
            'max_tokens' => 300,
            'response_format' => ['type' => 'json_object'],
        ]);

        $response->throw();

        $content = $response->json('choices.0.message.content', '{}');
        $data = json_decode($content, true) ?? [];

        $decision = $this->determineDecision($data);
        $confidence = (float) ($data['confidence'] ?? 0.5);

        return [
            'result' => $data,
            'decision' => $decision,
            'confidence' => $confidence,
            'model' => $model,
            'prompt_version' => $promptVersion,
        ];
    }

    private function getBase64Image(Photo $photo): string
    {
        $disk = config('filesystems.default', 's3');
        $content = \Illuminate\Support\Facades\Storage::disk($disk)->get($photo->object_key);
        return base64_encode($content);
    }

    private function buildPrompt(): string
    {
        return <<<PROMPT
Analisis foto ini untuk validasi laporan infrastruktur Kota Batam.

Kembalikan JSON dengan format:
{
  "feasibility": "valid" | "invalid" | "uncertain",
  "category": "pothole" | "street_light" | "other",
  "severity": "low" | "moderate" | "high" | "critical",
  "confidence": 0.0-1.0,
  "reason": "penjelasan singkat dalam Bahasa Indonesia"
}

Kriteria:
- valid: foto jelas menunjukkan kerusakan infrauktur
- invalid: foto tidak relevan, dari internet, atau tidak jelas
- uncertain: foto agak relevan tapi kurang jelas
- Kategori harus sesuai: pothole = jalan berlubang, street_light = lampu PJU mati
- Confidence: seberapa yakin Anda terhadap penilaian
PROMPT;
    }

    private function determineDecision(array $data): string
    {
        $feasibility = $data['feasibility'] ?? 'uncertain';
        $confidence = (float) ($data['confidence'] ?? 0.5);

        $acceptedThreshold = config('nadi-kota.ai.thresholds.accepted_min_confidence', 0.7);
        $rejectedThreshold = config('nadi-kota.ai.thresholds.rejected_max_confidence', 0.3);

        if ($feasibility === 'valid' && $confidence >= $acceptedThreshold) {
            return 'accepted';
        }

        if ($feasibility === 'invalid' || $confidence <= $rejectedThreshold) {
            return 'rejected';
        }

        return 'suspicious';
    }
}
