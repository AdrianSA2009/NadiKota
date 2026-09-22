<?php

namespace App\Services\Contracts;

use App\Models\User;

interface NotificationChannel
{
    /**
     * Kirim notifikasi ke user melalui channel ini.
     */
    public function send(User $user, array $payload): void;

    /**
     * Nama channel (in_app, whatsapp, sms, dll).
     */
    public function name(): string;
}
