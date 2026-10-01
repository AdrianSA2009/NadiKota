<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Models\User;
use App\Services\InAppNotificationChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Kirim notifikasi in-app ke semua user dengan role tertentu
 * (mis. admin → tiket baru / butuh penilaian; tim → tiket masuk).
 */
final class SendRoleNotification implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries;

    public int $timeout = 10;

    /**
     * @param  list<string>  $roles  role penerima (atau abaikan bila $userIds terisi)
     * @param  list<int>|null  $userIds  id user eksplisit (mis. anggota tim yang ditugaskan)
     * @param  array{type: string, title: string, body: string, data?: array<string, mixed>}  $payload
     */
    public function __construct(
        public readonly array $roles,
        public readonly array $payload,
        public readonly ?array $userIds = null,
    ) {
        $this->tries = config('nadi-kota.queue.notification_tries', 3);
    }

    public function handle(InAppNotificationChannel $channel): void
    {
        $users = $this->userIds !== null
            ? User::whereIn('id', $this->userIds)->get()
            : User::whereIn('role', $this->roles)->get();

        $users->each(fn (User $user) => $channel->send($user, $this->payload));
    }
}
