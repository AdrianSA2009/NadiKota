<?php

namespace App\Services;

use App\Models\Photo;
use App\Services\Contracts\AiImageValidator;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

class OpenAiImageValidator implements AiImageValidator
{
    public function validate(Photo $photo, array $pixelSignals = []): array
    {
        $model = config('nadi-kota.ai.model', 'gpt-4o-mini');
        $timeout = config('nadi-kota.ai.timeout_seconds', 20);
        $promptVersion = config('nadi-kota.ai.prompt_version', 'v1.0');
        $apiKey = config('services.openai.api_key', env('OPENAI_API_KEY'));
        $baseUrl = rtrim(config('nadi-kota.ai.base_url'), '/');

        $imageContent = $this->getBase64Image($photo);
        $prompt = $this->buildPrompt($pixelSignals);

        $response = Http::withHeaders([
            'Authorization' => 'Bearer ' . $apiKey,
            'Content-Type' => 'application/json',
        ])->timeout($timeout)->post($baseUrl . '/chat/completions', [
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
        $disk = config('filesystems.default', 'public');
        $content = Storage::disk($disk)->get($photo->object_key);

        return base64_encode($content);
    }

    private function buildPrompt(array $pixelSignals = []): string
    {
        $signals = $pixelSignals === []
            ? 'tidak ada sinyal piksel layar'
            : implode(', ', $pixelSignals);

        $prompt = str_replace('{{PIXEL_SIGNALS}}', $signals, <<<'PROMPT'
Analisis foto ini untuk validasi laporan infrastruktur Kota Batam.

LANGKAH 1 — tentukan "source" TERLEBIH DAHULU sebelum menilai apa pun:
- "direct" HANYA jika foto diambil langsung dengan kamera dari adegan nyata, tanpa elemen antarmuka apa pun.
- "rephoto" jika ada bukti eksplisit foto/screenshot dari layar: tombol/icon navigasi, bilah alamat browser, notch/sudut membulat bingkai layar, watermark/logo aplikasi, teks caption/artikel/judul di atas foto, jari memegang foto cetak, atau terlihat permukaan/piksel layar (garis RGB, grid piksel, bayangan bezel).
- "rephoto" JIKA pemeriksaan piksel internal menyebut ada sinyal layar DAN foto tampak seperti gambar yang ditampilkan/dihasilkan, bukan adegan langsung: komposisi sempurna ala stock/katalog, objek terpusat tanpa konteks dunia nyata di sekitarnya (trotoar, kendaraan, langit, rumput, orang), pencahayaan rata khas tampilan digital, atau bayangan/refleksi seragam di tepi.
- Pemeriksaan piksel internal: {{PIXEL_SIGNALS}}.
- JANGAN memilih "rephoto" hanya karena: pantulan cahaya/glare (aspal basah, kaca), pola moiré/garis halus TANPA sinyal internal di atas (pagar, kisi-kisi, ubin, tekstur kain), foto buram/gelap, atau objek tidak relevan. Foto adegan nyata yang punya konteks sekitar jelas tetap "direct".
- Foto buram, gelap, blur, atau tidak relevan TETAP "direct" selama tidak ada bukti layar. JANGAN memilih "rephoto" hanya karena fotonya tidak sesuai kriteria — nilai "feasibility" = "invalid" untuk itu.

LANGKAH 2 — nilai isi foto hanya jika source "direct".

Kembalikan JSON dengan format:
{
  "source": "direct" | "rephoto",
  "feasibility": "valid" | "invalid" | "uncertain",
  "category": "pothole" | "street_light" | "other",
  "severity": "low" | "moderate" | "high" | "critical",
  "confidence": 0.0-1.0,
  "reason": "penjelasan singkat dalam Bahasa Indonesia"
}

Kriteria feasibility (hanya untuk source "direct"):
- valid: foto jelas menunjukkan kerusakan infrastruktur
- invalid: foto tidak relevan atau tidak jelas
- uncertain: objek terlihat tapi kurang jelas
- Kategori: pothole = jalan berlubang, street_light = lampu PJU mati, other = lainnya
- severity untuk pothole: low = retak rambut, moderate = lubang kecil, high = lubang besar, critical = lubang dalam/membahayakan
PROMPT
        );

        return $prompt;
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
