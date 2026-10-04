<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Models\Photo;
use App\Services\Contracts\AiImageValidator;
use App\Services\PrivacyBlurService;
use App\Services\RecapturedPhotoDetector;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * Screening foto warga SEBELUM laporan dikirim (pemeriksaan kategori + keparahan).
 * Berbeda dengan ValidateReportImage yang berjalan sesudah laporan masuk.
 */
final class ScreenReportPhoto implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries;

    public int $timeout;

    public int $maxExceptions = 1;

    public function __construct(
        public readonly string $checkId,
        public readonly string $objectKey,
        public readonly string $mimeType,
    ) {
        $this->tries = config('nadi-kota.queue.validate_image_tries', 3);
        $this->timeout = config('nadi-kota.queue.validate_image_timeout', 30);
    }

    public static function cacheKey(string $checkId): string
    {
        return 'photo-screen:' . $checkId;
    }

    public function handle(
        AiImageValidator $validator,
        RecapturedPhotoDetector $detector,
        PrivacyBlurService $blur,
    ): void {
        try {
            $photo = new Photo([
                'object_key' => $this->objectKey,
                'mime_type' => $this->mimeType,
            ]);
            $contents = Storage::disk(config('filesystems.default'))->get($this->objectKey);
            $captureCheck = $detector->inspect($contents, $this->mimeType);

            // Bukti keras (penanda software screenshot) → tolak langsung tanpa AI.
            // Sinyal piksel saja (bingkai gelap/moiré) terlalu lemah — biarkan AI yang
            // memutuskan sumbernya, foto gelap/blur langsung dari kamera tidak boleh
            // dituduh diambil dari layar.
            if ($captureCheck['is_rephoto'] && $detector->hasHardEvidence($captureCheck)) {
                Cache::put(self::cacheKey($this->checkId), [
                    'status' => 'done',
                    'ok' => false,
                    'category' => null,
                    'severity' => null,
                    'confidence' => 1.0,
                    'detection' => 'rephoto',
                    'signals' => $captureCheck['signals'],
                    'reason' => 'Foto terdeteksi diambil dari layar atau gambar lain, bukan kamera langsung. Ambil foto langsung dengan kamera di lokasi.',
                ], 600);
                return;
            }

            // Sensor privasi (wajah + plat) di Screening; hasil tersensor dipakai frontend.
            $blurred = $blur->blur($contents, $this->mimeType);
            $counts = $blurred[1] ?? ['faces' => 0, 'plates' => 0];

            // Analisis AI memakai foto yang sudah disensor (eksif tetap di file asli).
            if ($blurred !== null && ($counts['faces'] > 0 || $counts['plates'] > 0)) {
                $scratch = 'photos/blur-scratch/' . $this->checkId . '.jpg';
                Storage::disk(config('filesystems.default'))->put($scratch, $blurred[0]);
                try {
                    $validation = $validator->validate(new Photo(['object_key' => $scratch, 'mime_type' => 'image/jpeg']), $captureCheck['signals']);
                } finally {
                    Storage::disk(config('filesystems.default'))->delete($scratch);
                }
            } else {
                $validation = $validator->validate($photo, $captureCheck['signals']);
            }
            $result = $validation['result'];
            $feasibility = $result['feasibility'] ?? 'uncertain';
            $sourceRephoto = ($result['source'] ?? 'direct') !== 'direct';
            // Sumber diragukan TAPI isi foto dinilai tidak valid → klasifikasi sebagai
            // "tidak sesuai kriteria", bukan "dari layar lain" (bukti sumbernya lemah).
            $isRephoto = $sourceRephoto && $feasibility !== 'invalid';

            Cache::put(self::cacheKey($this->checkId), [
                'status' => 'done',
                'ok' => $feasibility !== 'invalid' && ! $isRephoto,
                'category' => $result['category'] ?? null,
                'severity' => $result['severity'] ?? null,
                'confidence' => $validation['confidence'],
                'detection' => $isRephoto ? 'ai_rephoto' : 'direct',
                'has_camera_exif' => $captureCheck['has_camera_exif'],
                'signals' => $captureCheck['signals'],
                'redacted' => $blurred !== null ? $blurred[0] : null,
                'redacted_faces' => $counts['faces'],
                'redacted_plates' => $counts['plates'],
                'reason' => $isRephoto
                    ? 'Foto terdeteksi bukan pengambilan langsung (dari layar, screenshot, atau gambar internet). Ambil foto langsung dengan kamera di lokasi.'
                    : ($sourceRephoto
                        ? 'Foto tidak memenuhi kriteria: objek tidak jelas atau tidak relevan. Ambil foto ulang dengan objek kerusakan yang jelas.'
                        : ($result['reason'] ?? null)),
            ], 600);
        } catch (\Throwable $e) {
            Log::warning('ScreenReportPhoto failed', [
                'check_id' => $this->checkId,
                'error' => $e->getMessage(),
            ]);

            // AI tidak tersedia: jangan blokir warga — frontend lanjut tanpa screening.
            Cache::put(self::cacheKey($this->checkId), ['status' => 'unavailable'], 600);
        } finally {
            Storage::disk(config('filesystems.default'))->delete($this->objectKey);
        }
    }

    public function failed(\Throwable $exception): void
    {
        Cache::put(self::cacheKey($this->checkId), ['status' => 'unavailable'], 600);
    }
}
