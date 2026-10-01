<?php

use App\Services\LocationSpoofDetector;
use Illuminate\Support\Facades\Http;

uses();

it('ignores missing and private ip without any http call', function (): void {
    Http::fake();
    $detector = new LocationSpoofDetector();

    // Tanpa EXIF (null) dan IP privat → tidak ada sinyal, tidak ada request keluar
    expect($detector->inspect(null, 'image/jpeg', 1.1191, 104.0538, null))->toBe([]);
    expect($detector->inspect(null, 'image/jpeg', 1.1191, 104.0538, '192.168.1.10'))->toBe([]);
    expect($detector->inspect(null, 'image/jpeg', 1.1191, 104.0538, '127.0.0.1'))->toBe([]);

    Http::assertNothingSent();
});

it('flags ip whose geo location is far from claimed coordinates', function (): void {
    // 8.8.8.8 → Mountain View, AS; klaim koordinat di Batam → beda ~15.000 km
    Http::fake(['ip-api.com/*' => Http::response([
        'status' => 'success',
        'lat' => 37.386051,
        'lng' => -122.083851,
    ])]);

    $reasons = (new LocationSpoofDetector)->inspect(null, 'image/jpeg', 1.1191, 104.0538, '8.8.8.8');

    expect($reasons)->toHaveCount(1);
    expect($reasons[0])->toStartWith('ip_geo_mismatch:');
});

it('accepts ip consistent with claimed coordinates', function (): void {
    Http::fake(['ip-api.com/*' => Http::response([
        'status' => 'success',
        'lat' => 37.386051,
        'lng' => -122.083851,
    ])]);

    $reasons = (new LocationSpoofDetector)->inspect(null, 'image/jpeg', 37.386051, -122.083851, '8.8.8.8');

    expect($reasons)->toBe([]);
});
