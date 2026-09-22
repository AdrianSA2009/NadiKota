<?php

namespace App\Services\Contracts;

interface OtpProvider
{
    /**
     * Kirim OTP ke nomor telepon.
     */
    public function send(string $phone, string $otp): void;
}
