<?php

namespace App\Services;

use App\Services\Contracts\OtpProvider;
use Illuminate\Support\Facades\Log;

final class LogOtpProvider implements OtpProvider
{
    public function send(string $phone, string $otp): void
    {
        Log::info('OTP sent', ['phone' => $phone, 'otp' => $otp]);
    }
}
