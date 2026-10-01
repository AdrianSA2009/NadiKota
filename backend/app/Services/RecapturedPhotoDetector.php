<?php

declare(strict_types=1);

namespace App\Services;

use GdImage;

/**
 * Deteksi deterministik foto yang diambil ulang dari layar atau gambar lain.
 * Skor di bawah ambang berarti bukti belum cukup; jangan perlakukan sebagai rephoto.
 */
class RecapturedPhotoDetector
{
    private const PREVIEW_SIZE = 320;

    /**
     * @return array{is_rephoto: bool, score: float, has_camera_exif: bool, signals: list<string>}
     */
    public function inspect(string $contents, string $mimeType): array
    {
        $signals = [];
        $score = 0.0;
        $exif = $this->readExif($contents, $mimeType);
        $hasCameraExif = $this->hasCameraExif($exif);

        if ($this->looksLikeScreenshotSoftware($exif)) {
            $score += 0.95;
            $signals[] = 'metadata_screenshot';
        }

        $image = @imagecreatefromstring($contents);
        if (!$image instanceof GdImage) {
            return [
                'is_rephoto' => $score >= $this->threshold(),
                'score' => $score,
                'has_camera_exif' => $hasCameraExif,
                'signals' => $signals,
            ];
        }

        $pixelSignals = $this->inspectPixels($image);
        foreach ($pixelSignals['signals'] as $signal) {
            $signals[] = $signal['name'];
            $score += $signal['weight'];
        }

        imagedestroy($image);

        return [
            'is_rephoto' => $score >= $this->threshold(),
            'score' => round(min($score, 1.0), 2),
            'has_camera_exif' => $hasCameraExif,
            'signals' => $signals,
        ];
    }

    /**
     * Bukti keras rephoto: penanda software screenshot di metadata.
     * Sinyal piksel (bingkai gelap / moiré) terlalu lemah — foto malam atau
     * bertekstur bisa kena — jadi hanya jadi indikasi yang perlu konfirmasi AI.
     *
     * @param  array{is_rephoto: bool, score: float, has_camera_exif: bool, signals: list<string>}  $check
     */
    public function hasHardEvidence(array $check): bool
    {
        return in_array('metadata_screenshot', $check['signals'], true);
    }

    /**
     * @return array<string, mixed>
     */
    private function readExif(string $contents, string $mimeType): array
    {
        if (!str_contains(strtolower($mimeType), 'jpeg')) {
            return [];
        }

        $exif = @exif_read_data('data://image/jpeg;base64,' . base64_encode($contents), null, false, false);
        return is_array($exif) ? $exif : [];
    }

    /**
     * @param array<string, mixed> $exif
     */
    private function hasCameraExif(array $exif): bool
    {
        return isset($exif['Make'], $exif['Model'])
            && is_string($exif['Make'])
            && is_string($exif['Model'])
            && $exif['Make'] !== ''
            && $exif['Model'] !== '';
    }

    /**
     * @param array<string, mixed> $exif
     */
    private function looksLikeScreenshotSoftware(array $exif): bool
    {
        $metadata = strtolower(implode(' ', array_filter([
            (string) ($exif['Software'] ?? ''),
            (string) ($exif['ImageDescription'] ?? ''),
            (string) ($exif['UserComment'] ?? ''),
        ])));
        $markers = [
            'screenshot', 'screen shot', 'snapseed', 'gallery',
            'lightroom', 'photoshop', 'canva', 'pixelmator', 'facetune',
        ];

        foreach ($markers as $marker) {
            if (str_contains($metadata, $marker)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @return array{signals: list<array{name: string, weight: float}>}
     */
    private function inspectPixels(GdImage $image): array
    {
        $width = imagesx($image);
        $height = imagesy($image);
        if ($width < 64 || $height < 64) {
            return ['signals' => []];
        }

        $size = min(self::PREVIEW_SIZE, $width, $height);
        $preview = imagecreatetruecolor($size, $size);
        imagecopyresampled($preview, $image, 0, 0, 0, 0, $size, $size, $width, $height);

        $luma = $this->toLuma($preview, $size, $size);
        imagedestroy($preview);

        $signals = [];

        $edgeRatios = $this->darkEdgeRatios($luma, $size, $size);
        if (max($edgeRatios) >= $this->edgeDarkThreshold()) {
            $signals[] = ['name' => 'dark_screen_or_phone_edge', 'weight' => 0.9];
        }

        $moire = $this->periodicPatternScore($luma, $size, $size);
        if ($moire >= $this->periodicCorrelationThreshold()) {
            $signals[] = ['name' => 'periodic_moire_pattern', 'weight' => 0.85];
        }

        return ['signals' => $signals];
    }

    /**
     * @return list<float>
     */
    private function toLuma(GdImage $image, int $width, int $height): array
    {
        $luma = [];
        for ($y = 0; $y < $height; $y++) {
            for ($x = 0; $x < $width; $x++) {
                $rgb = imagecolorat($image, $x, $y);
                $luma[] = 0.299 * (($rgb >> 16) & 0xFF)
                    + 0.587 * (($rgb >> 8) & 0xFF)
                    + 0.114 * ($rgb & 0xFF);
            }
        }

        return $luma;
    }

    /**
     * Hitung rasio piksel gelap per sisi. Satu sisi gelap tebal cukup untuk
     * menandai bingkai layar/HP; seluruh sisi gelap dapat terjadi pada malam.
     *
     * @param list<float> $luma
     * @return array{top: float, right: float, bottom: float, left: float}
     */
    private function darkEdgeRatios(array $luma, int $width, int $height): array
    {
        $band = max(2, (int) round(min($width, $height) * 0.04));
        $dark = ['top' => 0, 'right' => 0, 'bottom' => 0, 'left' => 0];

        for ($x = 0; $x < $width; $x++) {
            for ($offset = 0; $offset < $band; $offset++) {
                $dark['top'] += (int) (($luma[($offset * $width) + $x] ?? 255) < 75);
                $dark['bottom'] += (int) (($luma[(($height - 1 - $offset) * $width) + $x] ?? 255) < 75);
            }
        }
        for ($y = 0; $y < $height; $y++) {
            for ($offset = 0; $offset < $band; $offset++) {
                $dark['left'] += (int) (($luma[($y * $width) + $offset] ?? 255) < 75);
                $dark['right'] += (int) (($luma[($y * $width) + ($width - 1 - $offset)] ?? 255) < 75);
            }
        }

        $horizontalTotal = max(1, $width * $band);
        $verticalTotal = max(1, $height * $band);
        return [
            'top' => ($dark['top'] / $horizontalTotal) * 100,
            'right' => ($dark['right'] / $verticalTotal) * 100,
            'bottom' => ($dark['bottom'] / $horizontalTotal) * 100,
            'left' => ($dark['left'] / $verticalTotal) * 100,
        ];
    }

    /**
     * Correlation kuat pada jarak kecil menandakan pola periodik, bukan tekstur alami.
     *
     * @param list<float> $luma
     */
    private function periodicPatternScore(array $luma, int $width, int $height): float
    {
        $best = 0.0;

        for ($lag = 2; $lag <= 6; $lag++) {
            $best = max($best, abs($this->rowCorrelation($luma, $width, $height, $lag)));
            $best = max($best, abs($this->columnCorrelation($luma, $width, $height, $lag)));
        }

        return $best;
    }

    /**
     * @param list<float> $luma
     */
    private function rowCorrelation(array $luma, int $width, int $height, int $lag): float
    {
        $sumA = $sumB = $sumAA = $sumBB = $sumAB = 0.0;
        $count = 0;

        for ($y = 0; $y < $height; $y++) {
            for ($x = 0; $x + $lag < $width; $x++) {
                $a = $luma[($y * $width) + $x];
                $b = $luma[($y * $width) + $x + $lag];
                $sumA += $a;
                $sumB += $b;
                $sumAA += $a * $a;
                $sumBB += $b * $b;
                $sumAB += $a * $b;
                $count++;
            }
        }

        if ($count === 0) {
            return 0.0;
        }

        $meanA = $sumA / $count;
        $meanB = $sumB / $count;
        $numerator = $sumAB - ($sumA * $sumB / $count);
        $denominator = sqrt(max(0.0, ($sumAA - ($sumA * $sumA / $count)) * ($sumBB - ($sumB * $sumB / $count))));

        return $denominator === 0.0 ? 0.0 : $numerator / $denominator;
    }

    /**
     * @param list<float> $luma
     */
    private function columnCorrelation(array $luma, int $width, int $height, int $lag): float
    {
        $sumA = $sumB = $sumAA = $sumBB = $sumAB = 0.0;
        $count = 0;

        for ($y = 0; $y + $lag < $height; $y++) {
            for ($x = 0; $x < $width; $x++) {
                $a = $luma[($y * $width) + $x];
                $b = $luma[(($y + $lag) * $width) + $x];
                $sumA += $a;
                $sumB += $b;
                $sumAA += $a * $a;
                $sumBB += $b * $b;
                $sumAB += $a * $b;
                $count++;
            }
        }

        if ($count === 0) {
            return 0.0;
        }

        $meanA = $sumA / $count;
        $meanB = $sumB / $count;
        $numerator = $sumAB - ($sumA * $sumB / $count);
        $denominator = sqrt(max(0.0, ($sumAA - ($sumA * $sumA / $count)) * ($sumBB - ($sumB * $sumB / $count))));

        return $denominator === 0.0 ? 0.0 : $numerator / $denominator;
    }

    private function threshold(): float
    {
        return (float) config('nadi-kota.ai.rephoto.score_threshold', 0.8);
    }

    private function edgeDarkThreshold(): float
    {
        return (float) config('nadi-kota.ai.rephoto.edge_dark_ratio', 62);
    }

    private function periodicCorrelationThreshold(): float
    {
        return (float) config('nadi-kota.ai.rephoto.periodic_correlation', 0.9);
    }
}
