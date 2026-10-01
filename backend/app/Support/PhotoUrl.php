<?php

declare(strict_types=1);

namespace App\Support;

use Illuminate\Support\Facades\Storage;

final class PhotoUrl
{
    /**
     * URL foto siap pakai. Mendukung S3 (signed temporary URL)
     * maupun disk lokal (public URL) tanpa akun AWS.
     */
    public static function make(?string $objectKey): ?string
    {
        if ($objectKey === null || $objectKey === '') {
            return null;
        }

        try {
            return Storage::disk()->temporaryUrl($objectKey, now()->addMinutes(30));
        } catch (\Throwable) {
            // Disk lokal tidak mendukung temporaryUrl — pakai URL biasa.
            return Storage::disk()->url($objectKey);
        }
    }
}
