<?php

declare(strict_types=1);

namespace App\Services;

use App\Mail\RegisterOtpMail;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Redis;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;

/**
 * OTP registrasi via email — data pendaftaran menunggu di Redis
 * sampai OTP valid, lalu dikonversi jadi akun sungguhan.
 */
final class EmailOtpService
{
    private const OTP_PREFIX = 'email_otp:';
    private const PENDING_PREFIX = 'register_pending:';

    /**
     * Generate OTP, simpan pending registrasi, kirim kode ke email.
     *
     * @param  array<string, mixed>  $payload  data pendaftaran (password sudah di-hash)
     */
    public function send(string $email, array $payload): void
    {
        $length = (int) config('nadi-kota.otp.length', 6);
        $expiryMinutes = (int) config('nadi-kota.otp.expiry_minutes', 5);
        $otp = (string) random_int(10 ** ($length - 1), 10 ** $length - 1);
        $ttl = $expiryMinutes * 60;

        Redis::setex(self::OTP_PREFIX . $email, $ttl, json_encode([
            'otp' => hash('sha256', $otp),
            'attempts' => 0,
            'max_attempts' => (int) config('nadi-kota.otp.max_attempts', 3),
        ]));
        Redis::setex(self::PENDING_PREFIX . $email, $ttl, json_encode($payload));

        try {
            Mail::to($email)->send(new RegisterOtpMail($otp, $expiryMinutes));
        } catch (TransportExceptionInterface $e) {
            // Jangan tinggalkan OTP/pending account saat email gagal terkirim.
            Redis::del([self::OTP_PREFIX . $email, self::PENDING_PREFIX . $email]);
            throw $e;
        }
    }

    /**
     * Verifikasi OTP. Return data pendaftaran bila valid, null bila gagal/kedaluwarsa.
     *
     * @return array<string, mixed>|null
     */
    public function verify(string $email, string $otp): ?array
    {
        $otpKey = self::OTP_PREFIX . $email;
        $data = Redis::get($otpKey);

        if (! $data) {
            return null;
        }

        $payload = json_decode($data, true);

        if ($payload['attempts'] >= $payload['max_attempts']) {
            Redis::del([$otpKey, self::PENDING_PREFIX . $email]);

            return null;
        }

        if (hash('sha256', $otp) !== $payload['otp']) {
            $payload['attempts']++;
            Redis::setex($otpKey, (int) config('nadi-kota.otp.expiry_minutes', 5) * 60, json_encode($payload));

            return null;
        }

        $pending = Redis::get(self::PENDING_PREFIX . $email);
        Redis::del([$otpKey, self::PENDING_PREFIX . $email]);

        return $pending ? json_decode($pending, true) : null;
    }
}
