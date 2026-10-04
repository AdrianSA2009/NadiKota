<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Models\Photo;
use App\Services\PrivacyBlurService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * Sensor ulang foto lama (yang tersimpan sebelum fitur privasi aktif).
 * Satu foto satu job — aman & idempoten (foto tanpa privasi tidak berubah).
 */
final class RedactLegacyPhotos implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;

    public int $timeout = 60;

    public function __construct(
        public readonly ?int $photoId = null,
    ) {}

    public function handle(PrivacyBlurService $blur): void
    {
        $query = Photo::query()->where('type', 'before');
        if ($this->photoId !== null) {
            $query->whereKey($this->photoId);
        }

        $done = 0;
        foreach ($query->cursor() as $photo) {
            try {
                $before = Storage::disk(config('filesystems.default'))->get($photo->object_key);
                $result = $blur->blur($before, $photo->mime_type ?? 'image/jpeg');

                if ($result === null || $result[0] === $before) {
                    continue; // tidak ada privasi / gagal — biarkan
                }

                Storage::disk(config('filesystems.default'))->put($photo->object_key, $result[0]);
                $photo->update([
                    'sha256' => hash('sha256', $result[0]),
                    'size_bytes' => strlen($result[0]),
                ]);
                $done++;
            } catch (\Throwable $e) {
                Log::warning('RedactLegacyPhotos gagal', ['photo_id' => $photo->id, 'error' => $e->getMessage()]);
            }
        }

        Log::info('RedactLegacyPhotos selesai', ['disensor' => $done]);
    }
}