<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * Sinyal lokasi mencurigakan (fake GPS / lokasi tidak konsisten).
 * Bukan bukti mutlak — hasilnya hanya untuk menahan laporan ke needs_review.
 */
final class LocationSpoofDetector
{
    /**
     * @param  string|null  $contents  bytes foto (null jika tidak tersedia)
     * @param  string|null  $ip  IP klien saat laporan dibuat
     * @return list<string> alasan anomali, kosong = tidak ada sinyal
     */
    public function inspect(?string $contents, string $mimeType, float $latitude, float $longitude, ?string $ip = null): array
    {
        $reasons = [];

        $gps = $this->gpsFromExif($contents, $mimeType);
        if ($gps !== null) {
            $meters = $this->distanceMeters($gps[0], $gps[1], $latitude, $longitude);
            if ($meters > (float) config('nadi-kota.geo.exif_mismatch_meters', 500)) {
                $reasons[] = 'exif_gps_mismatch:' . (int) $meters . 'm';
            }
        }

        $ipCoords = $this->ipLocation($ip);
        if ($ipCoords !== null) {
            $km = $this->distanceMeters($ipCoords[0], $ipCoords[1], $latitude, $longitude) / 1000;
            if ($km > (float) config('nadi-kota.geo.ip_mismatch_km', 100)) {
                $reasons[] = 'ip_geo_mismatch:' . (int) $km . 'km';
            }
        }

        return $reasons;
    }

    /**
     * @return array{0: float, 1: float}|null [lat, lng] dari EXIF GPS, null jika tidak ada
     */
    private function gpsFromExif(?string $contents, string $mimeType): ?array
    {
        if ($contents === null || ! str_contains(strtolower($mimeType), 'jpeg')) {
            return null;
        }

        $exif = @exif_read_data('data://image/jpeg;base64,' . base64_encode($contents), null, false, false);
        if (! is_array($exif)) {
            return null;
        }

        $lat = $this->toDecimal($exif['GPSLatitude'] ?? null, strtoupper((string) ($exif['GPSLatitudeRef'] ?? 'N')));
        $lng = $this->toDecimal($exif['GPSLongitude'] ?? null, strtoupper((string) ($exif['GPSLongitudeRef'] ?? 'E')));

        return ($lat === null || $lng === null) ? null : [$lat, $lng];
    }

    /**
     * Terima komponen derajat-menit-detik dalam bentuk array, string "42 deg 30' 15"",
     * atau string rasional "4/1, 30/1, 1536/100".
     */
    private function toDecimal(mixed $value, string $ref): ?float
    {
        if (is_array($value)) {
            $components = array_values($value);
        } elseif (is_string($value) && $value !== '') {
            if (str_contains($value, 'deg')) {
                preg_match_all('/(\d+(?:\.\d+)?)/', $value, $matches);
                $components = array_slice($matches[1], 0, 3);
            } else {
                $components = array_map('trim', explode(',', $value));
            }
        } else {
            return null;
        }

        if (count($components) < 3) {
            return null;
        }

        $parts = [];
        foreach (array_slice($components, 0, 3) as $component) {
            if (is_string($component) && str_contains($component, '/')) {
                [$num, $den] = array_pad(explode('/', $component, 2), 2, '1');
                $denominator = (float) $den;
                if ($denominator == 0.0 || ! is_numeric($num)) {
                    return null;
                }
                $parts[] = (float) $num / $denominator;
            } elseif (is_numeric($component)) {
                $parts[] = (float) $component;
            } else {
                return null;
            }
        }

        $decimal = $parts[0] + $parts[1] / 60 + $parts[2] / 3600;

        return in_array($ref, ['S', 'W'], true) ? -$decimal : $decimal;
    }

    /**
     * Lookup kota dari IP (ip-api.com). IP privat/reserved dilewati (dev LAN).
     *
     * ponytail: HTTP eksternal per laporan — upgrade ke DB offline MaxMind GeoLite2
     * kalau butuh tanpa dependensi jaringan atau volume request besar.
     *
     * @return array{0: float, 1: float}|null
     */
    private function ipLocation(?string $ip): ?array
    {
        if ($ip === null || filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) {
            return null;
        }

        try {
            $url = rtrim((string) config('nadi-kota.geo.ip_lookup_url', 'http://ip-api.com/json'), '/') . '/' . rawurlencode($ip);
            $json = Http::timeout(2)->get($url, ['fields' => 'status,lat,lng'])->json();

            if (($json['status'] ?? null) !== 'success' || ! isset($json['lat'], $json['lng'])) {
                return null;
            }

            return [(float) $json['lat'], (float) $json['lng']];
        } catch (Throwable) {
            return null;
        }
    }

    private function distanceMeters(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earthRadius = 6371000.0;
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;

        return 2 * $earthRadius * asin(min(1.0, sqrt($a)));
    }
}
