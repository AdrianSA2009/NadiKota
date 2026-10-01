<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Jobs\ScreenReportPhoto;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

final class PhotoScreeningController extends Controller
{
    /**
     * Terima foto dari wizard laporan, dispatch screening AI, kembalikan checkId.
     */
    public function check(Request $request): JsonResponse
    {
        $data = $request->validate([
            'photo' => [
                'required',
                'image',
                'mimes:jpeg,jpg,png,webp',
                'max:' . (int) (config('nadi-kota.photo.max_size_bytes', 1_048_576) / 1024),
            ],
        ]);

        $file = $request->file('photo');
        $path = $file->store('photos/screening');
        if ($path === false) {
            return response()->json(['error' => ['message' => 'Foto gagal disimpan. Coba lagi.']], 500);
        }

        $checkId = (string) Str::uuid();
        ScreenReportPhoto::dispatch($checkId, $path, $file->getMimeType() ?? 'image/jpeg')
            ->onQueue('ai-validation')
            ->afterCommit();

        return response()->json(['data' => ['checkId' => $checkId]], 202);
    }

    /**
     * Hasil screening (dipoll frontend sampai status bukan pending).
     */
    public function result(string $checkId): JsonResponse
    {
        abort_unless(Str::isUuid($checkId), 404);

        $result = Cache::get(ScreenReportPhoto::cacheKey($checkId));

        return response()->json(['data' => $result ?? ['status' => 'pending']]);
    }
}
