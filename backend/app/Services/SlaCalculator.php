<?php

declare(strict_types=1);

namespace App\Services;

/**
 * Batas waktu penyelesaian tiket (SLA) per kategori.
 * Diisi saat admin menyetujui tiket (status queued) — dibaca command eskalasi.
 */
final class SlaCalculator
{
    /**
     * @return int jumlah hari kerja untuk menyelesaikan tiket kategori ini
     */
    public static function daysFor(mixed $category): int
    {
        $key = $category instanceof \BackedEnum ? $category->value : (string) $category;

        $days = (array) config('nadi-kota.sla.days_by_category', [
            'pothole' => 3,
            'street_light' => 7,
            'other' => 7,
        ]);

        return (int) ($days[$key] ?? 7);
    }
}