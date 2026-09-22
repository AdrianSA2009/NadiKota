<?php

namespace App\Services;

use App\Models\User;
use App\Services\Contracts\NotificationChannel;

class InAppNotificationChannel implements NotificationChannel
{
    public function send(User $user, array $payload): void
    {
        $user->notifications()->create([
            'type' => $payload['type'] ?? 'ticket_update',
            'title' => $payload['title'] ?? 'Notifikasi',
            'body' => $payload['body'] ?? '',
            'data' => $payload['data'] ?? [],
            'channel' => $this->name(),
        ]);
    }

    public function name(): string
    {
        return 'in_app';
    }
}
