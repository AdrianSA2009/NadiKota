<?php

namespace App\Http\Requests;

use App\Enums\ReportCategory;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class StoreReportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        $latMin = config('nadi-kota.geo.bounding_box.min_lat', 0.9);
        $latMax = config('nadi-kota.geo.bounding_box.max_lat', 1.3);
        $lngMin = config('nadi-kota.geo.bounding_box.min_lng', 103.6);
        $lngMax = config('nadi-kota.geo.bounding_box.max_lng', 104.2);
        $maxSize = config('nadi-kota.photo.max_size_bytes', 1048576);

        return [
            'category' => ['required', Rule::enum(ReportCategory::class)],
            'latitude' => ['required', 'numeric', "between:{$latMin},{$latMax}"],
            'longitude' => ['required', 'numeric', "between:{$lngMin},{$lngMax}"],
            'photo' => ['required', 'image', 'max:' . ($maxSize / 1024)],
        ];
    }

    public function messages(): array
    {
        return [
            'category.required' => 'Kategori wajib diisi.',
            'category.in' => 'Kategori tidak valid.',
            'latitude.required' => 'Lintang wajib diisi.',
            'latitude.between' => 'Lintang berada di luar area Batam.',
            'longitude.required' => 'Bujur wajib diisi.',
            'longitude.between' => 'Bujur berada di luar area Batam.',
            'photo.required' => 'Foto wajib diunggah.',
            'photo.image' => 'File harus berupa gambar.',
            'photo.max' => 'Ukuran foto melebihi batas maksimal.',
        ];
    }
}
