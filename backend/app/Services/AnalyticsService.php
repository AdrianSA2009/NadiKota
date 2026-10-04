<?php

namespace App\Services;

use App\Enums\TicketStatus;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;

class AnalyticsService
{
    /**
     * Ambil ringkasan KPI dashboard admin.
     *
     * Performa: DB remote (Supabase) punya RTT ~250 ms, jadi query berurutan mahal.
     * Karena itu SEMUA agregasi digabung dalam satu query DB, dan hasilnya
     * di-cache Redis (lihat TTL di bawah).
     */
    public function getSummary(): array
    {
        $cacheKey = 'analytics:summary:v2';
        $cached = Redis::get($cacheKey);

        if ($cached) {
            return json_decode($cached, true);
        }

        // GABUNG semua agregat ke dalam 1 query (bukan 8 query berurutan @ ~250ms each).
        $aggr = DB::selectOne(<<<'SQL'
            SELECT
                count(*)                                                                   AS total_tickets,
                count(*) FILTER (WHERE verified_at  IS NOT NULL)                           AS verified_cnt,
                count(*) FILTER (WHERE completed_at IS NOT NULL)                           AS completed_cnt,
                count(*) FILTER (
                    WHERE status IN ('queued', 'in_progress')
                      AND sla_due_at IS NOT NULL AND sla_due_at < now()
                )                                                                          AS sla_escalated,
                AVG(EXTRACT(EPOCH FROM (verified_at  - created_at)) / 3600)
                    FILTER (WHERE verified_at IS NOT NULL)                                 AS avg_response_hours,
                AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) / 3600)
                    FILTER (WHERE completed_at IS NOT NULL)                               AS avg_completion_hours
            FROM tickets
        SQL);

        $chartRows = DB::select(<<<'SQL'
            SELECT to_char(date(created_at), 'YYYY-MM-DD') AS day, count(*) AS count
            FROM reports
            WHERE created_at >= (now() - interval '13 days')
            GROUP BY day
        SQL);
        $chartCounts = [];
        foreach ($chartRows as $row) {
            $chartCounts[$row->day] = (int) $row->count;
        }
        $chart = [];
        for ($i = 0; $i < 14; $i++) {
            $key = now()->subDays(13 - $i)->format('Y-m-d');
            $chart[] = ['date' => $key, 'count' => $chartCounts[$key] ?? 0];
        }

        $data = [
            'tickets_by_status' => $this->getTicketsByStatus(),
            'response_time' => $aggr->avg_response_hours ? round((float) $aggr->avg_response_hours, 2) : null,
            'completion_time' => $aggr->avg_completion_hours ? round((float) $aggr->avg_completion_hours, 2) : null,
            'consolidation_rate' => $this->getConsolidationRate(),
            'team_performance' => $this->getTeamPerformance(),
            'total_tickets' => (int) $aggr->total_tickets,
            'total_users' => User::count(),
            'unique_reporters' => DB::table('reports')->distinct()->count('user_id'),
            'sla_escalated' => (int) $aggr->sla_escalated,
            'chart' => $chart,
            'generated_at' => now()->toIso8601String(),
        ];

        // TTL 60 detik — query agregat berat, tidak perlu fresh tiap 30 detik.
        Redis::setex($cacheKey, 60, json_encode($data));

        return $data;
    }

    private function getTicketsByStatus(): array
    {
        return Ticket::select('status', DB::raw('count(*) as count'))
            ->groupBy('status')
            ->pluck('count', 'status')
            ->toArray();
    }

    /** Rata-rata waktu respons (jam) — dihitung dalam query agregat utama (helper tak dipakai). */
    private function getAverageResponseTime(): ?float
    {
        // Rata-rata waktu dari created_at ke verified_at (jam)
        $result = Ticket::whereNotNull('verified_at')
            ->selectRaw('AVG(EXTRACT(EPOCH FROM (verified_at - created_at)) / 3600) as avg_hours')
            ->value('avg_hours');

        return $result ? round($result, 2) : null;
    }

    private function getAverageCompletionTime(): ?float
    {
        // Rata-rata waktu dari created_at ke completed_at (jam)
        $result = Ticket::whereNotNull('completed_at')
            ->selectRaw('AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) / 3600) as avg_hours')
            ->value('avg_hours');

        return $result ? round($result, 2) : null;
    }

    private function getConsolidationRate(): float
    {
        $totalReports = DB::table('reports')->count();
        $consolidatedReports = DB::table('reports')
            ->whereNotNull('ticket_id')
            ->whereRaw('ticket_id != (SELECT MIN(r2.id) FROM reports r2 WHERE r2.ticket_id = reports.ticket_id)')
            ->count();

        if ($totalReports === 0) {
            return 0.0;
        }

        return round(($consolidatedReports / $totalReports) * 100, 2);
    }

    private function getTeamPerformance(): array
    {
        return DB::table('tickets')
            ->join('teams', 'teams.id', '=', 'tickets.assigned_team_id')
            ->where('tickets.status', TicketStatus::COMPLETED->value)
            ->select(
                'teams.name as team_name',
                DB::raw('count(*) as completed_count'),
                DB::raw('AVG(EXTRACT(EPOCH FROM (tickets.completed_at - tickets.started_at)) / 3600) as avg_hours')
            )
            ->groupBy('teams.name')
            ->get()
            ->map(fn ($row) => [
                'team_name' => $row->team_name,
                'completed_count' => (int) $row->completed_count,
                'avg_completion_hours' => $row->avg_hours ? round($row->avg_hours, 2) : null,
            ])
            ->toArray();
    }
}
