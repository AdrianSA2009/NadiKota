<?php

namespace App\Jobs;

use App\Models\Ticket;
use App\Services\InAppNotificationChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SendTicketNotification implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries;

    public int $timeout = 10;

    public function __construct(
        public readonly int $ticketId,
        public readonly string $status,
        public readonly ?string $extraMessage = null,
    ) {
        $this->tries = config('nadi-kota.queue.notification_tries', 3);
    }

    public function handle(InAppNotificationChannel $channel): void
    {
        $ticket = Ticket::with(['reporters.user', 'team.members'])->findOrFail($this->ticketId);

        $statusLabel = match ($this->status) {
            'verified' => 'Diverifikasi',
            'queued' => 'Dalam Antrean',
            'in_progress' => 'Dalam Perbaikan',
            'completed' => 'Selesai',
            'rejected' => 'Ditolak',
            'cancelled' => 'Dibatalkan',
            'needs_review' => 'Perlu Tinjauan',
            default => $this->status,
        };

        $title = "Status Tiket {$ticket->ticket_number}";
        $body = "Tiket Anda berstatus: {$statusLabel}.";
        if ($this->extraMessage) {
            $body .= ' ' . $this->extraMessage;
        }

        $payload = [
            'type' => 'ticket_status_change',
            'title' => $title,
            'body' => $body,
            'data' => [
                'ticket_id' => $ticket->id,
                'ticket_number' => $ticket->ticket_number,
                'status' => $this->status,
                'category' => $ticket->category,
            ],
        ];

        // Kirim ke semua warga terhubung
        foreach ($ticket->reporters as $reporter) {
            if ($reporter->user) {
                $channel->send($reporter->user, $payload);
            }
        }

        // Kirim ke tim saat dispatch
        if ($this->status === 'in_progress' && $ticket->team) {
            foreach ($ticket->team->members as $member) {
                $channel->send($member, [
                    'type' => 'ticket_assigned',
                    'title' => "Tiket Ditugaskan: {$ticket->ticket_number}",
                    'body' => 'Anda ditugaskan untuk menangani tiket ini.',
                    'data' => [
                        'ticket_id' => $ticket->id,
                        'ticket_number' => $ticket->ticket_number,
                        'status' => $this->status,
                    ],
                ]);
            }
        }

        Log::info('Notifications sent', [
            'ticket_id' => $ticket->id,
            'status' => $this->status,
            'reporter_count' => $ticket->reporters->count(),
        ]);
    }

    public function failed(\Throwable $exception): void
    {
        Log::error('SendTicketNotification failed', [
            'ticket_id' => $this->ticketId,
            'error' => $exception->getMessage(),
        ]);
    }
}
