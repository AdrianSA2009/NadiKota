<?php

namespace App\Console\Commands;

use App\Enums\TicketStatus;
use App\Enums\UserRole;
use App\Jobs\SendTicketNotification;
use App\Models\AuditLog;
use App\Models\Ticket;
use App\Models\User;
use App\Services\InAppNotificationChannel;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class EscalateOverdueTickets extends Command
{
    protected $signature = 'nadi:escalate-overdue';
    protected $description = 'Deteksi tiket terlambat dan kirim eskalasi berjenjang';

    public function handle(InAppNotificationChannel $channel): int
    {
        $this->info('Checking for overdue tickets...');

        $overdueTickets = Ticket::whereNotIn('status', [TicketStatus::COMPLETED, TicketStatus::REJECTED])
            ->where('sla_due_at', '<=', now())
            ->where('sla_due_at', '!=', null)
            ->get();

        $this->info("Found {$overdueTickets->count()} overdue tickets.");

        $escalationConfig = config('nadi-kota.sla.escalation', [
            'day_1_role' => 'supervisor',
            'day_3_role' => 'admin',
            'day_5_role' => 'super_admin',
        ]);

        $escalatedCount = 0;

        foreach ($overdueTickets as $ticket) {
            $daysOverdue = now()->diffInDays($ticket->sla_due_at);

            $escalationRole = $this->determineEscalationRole($daysOverdue, $escalationConfig);

            if ($escalationRole) {
                $this->escalateTicket($ticket, $escalationRole, $daysOverdue, $channel);
                $escalatedCount++;
            }
        }

        $this->info("Escalated {$escalatedCount} tickets.");

        return self::SUCCESS;
    }

    private function determineEscalationRole(int $daysOverdue, array $config): ?string
    {
        if ($daysOverdue >= 5) {
            return $config['day_5_role'];
        }
        if ($daysOverdue >= 3) {
            return $config['day_3_role'];
        }
        if ($daysOverdue >= 1) {
            return $config['day_1_role'];
        }

        return null;
    }

    private function escalateTicket(Ticket $ticket, string $role, int $daysOverdue, InAppNotificationChannel $channel): void
    {
        DB::transaction(function () use ($ticket, $role, $daysOverdue, $channel) {
            // Cari user dengan role yang sesuai
            $escalationUsers = User::where('role', $role)->get();

            if ($escalationUsers->isEmpty()) {
                Log::warning('No users found for escalation role', [
                    'ticket_id' => $ticket->id,
                    'role' => $role,
                ]);
                return;
            }

            $roleLabel = match ($role) {
                'supervisor' => 'Supervisor',
                'admin' => 'Admin Dinas',
                'super_admin' => 'Kepala Dinas',
                default => $role,
            };

            $message = "Tiket {$ticket->ticket_number} telah melewati SLA {$daysOverdue} hari. Membutuhkan tindakan segera.";

            // Kirim notifikasi ke user dengan role eskalasi
            foreach ($escalationUsers as $user) {
                $channel->send($user, [
                    'type' => 'sla_escalation',
                    'title' => "ESKALASI SLA: {$ticket->ticket_number}",
                    'body' => $message,
                    'data' => [
                        'ticket_id' => $ticket->id,
                        'ticket_number' => $ticket->ticket_number,
                        'days_overdue' => $daysOverdue,
                        'escalation_role' => $role,
                        'category' => $ticket->category,
                        'status' => $ticket->status->value,
                    ],
                ]);
            }

            // Audit log
            AuditLog::create([
                'action' => 'sla_escalation',
                'entity_type' => Ticket::class,
                'entity_id' => $ticket->id,
                'before' => [
                    'sla_due_at' => $ticket->sla_due_at?->toIso8601String(),
                    'escalation_level' => null,
                ],
                'after' => [
                    'days_overdue' => $daysOverdue,
                    'escalation_role' => $role,
                    'escalated_users' => $escalationUsers->pluck('id')->toArray(),
                ],
            ]);

            Log::info('Ticket escalated', [
                'ticket_id' => $ticket->id,
                'days_overdue' => $daysOverdue,
                'escalation_role' => $role,
                'user_count' => $escalationUsers->count(),
            ]);
        });
    }
}
