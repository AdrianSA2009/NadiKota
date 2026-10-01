<?php

namespace App\Services;

use App\Services\Contracts\OtpProvider;
use Illuminate\Support\Facades\Redis;

final class OtpService
{
    private const PREFIX = 'otp:';

    public function __construct(
        private readonly OtpProvider $provider,
    ) {}

    /**
     * Generate dan kirim OTP.
     */
    public function send(string $phone): void
    {
        $length = config('nadi-kota.otp.length', 6);
        $otp = (string) random_int(10 ** ($length - 1), (10 ** $length) - 1);

        $key = self::PREFIX . $phone;
        $maxAttempts = config('nadi-kota.otp.max_attempts', 3);

        Redis::setex($key, config('nadi-kota.otp.expiry_minutes', 5) * 60, json_encode([
            'otp' => hash('sha256', $otp),
            'attempts' => 0,
            'max_attempts' => $maxAttempts,
        ]));

        $this->provider->send($phone, $otp);
    }

    /**
     * Verifikasi OTP. Return true jika valid.
     */
    public function verify(string $phone, string $otp): bool
    {
        $key = self::PREFIX . $phone;
        $data = Redis::get($key);

        if (! $data) {
            return false;
        }

        $payload = json_decode($data, true);

        if ($payload['attempts'] >= $payload['max_attempts']) {
            Redis::del($key);

            return false;
        }

        if (hash('sha256', $otp) !== $payload['otp']) {
            $payload['attempts']++;
            Redis::setex($key, config('nadi-kota.otp.expiry_minutes', 5) * 60, json_encode($payload));

            return false;
        }

        Redis::del($key);

        return true;
    }
}
