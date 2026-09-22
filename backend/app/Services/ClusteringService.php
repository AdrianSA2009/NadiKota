<?php

namespace App\Services;

use App\Models\Report;
use App\Models\Ticket;
use App\Models\TicketReporter;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ClusteringService
{
    /**
     * Tambah pelapor unik ke tiket — idempotent via unique constraint.
     */
    public function addUniqueReporter(int $ticketId, int $userId): void
    {
        TicketReporter::firstOrCreate([
            'ticket_id' => $ticketId,
            'user_id' => $userId,
        ]);
    }

    /**
     * Buat tiket baru dari laporan dengan lokasi PostGIS.
     */
    public function createTicketFromReport(Report $report): Ticket
    {
        $ticket = Ticket::create([
            'ticket_number' => 'NDI-' . strtoupper(Str::random(8)),
            'category' => $report->category,
            'status' => 'reported',
            'priority_label' => 'waiting',
            'priority_score' => 0,
        ]);

        DB::table('tickets')
            ->where('id', $ticket->id)
            ->update([
                'location' => DB::raw("ST_SetSRID(ST_MakePoint({$report->longitude}, {$report->latitude}), 4326)"),
            ]);

        return $ticket->fresh();
    }
}
