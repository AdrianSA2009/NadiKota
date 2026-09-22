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
     */
    public function getSummary(): array
    {
        $cacheKey = 'analytics:summary';
        $cached = Redis::get($cacheKey);

        if ($cached) {
            return json_decode($cached, true);
        }

        $data = [
            'tickets_by_status' => $this->getTicketsByStatus(),
            'response_time' => $this->getAverageResponseTime(),
            'completion_time' => $this->getAverageCompletionTime(),
            'consolidation_rate' => $this->getConsolidationRate(),
            'team_performance' => $this->getTeamPerformance(),
            'total_tickets' => Ticket::count(),
            'total_users' => User::count(),
            'generated_at' => now()->toIso8601String(),
        ];

        Redis::setex($cacheKey, 300, json_encode($data)); // cache 5 menit

        return $data;
    }

    private function getTicketsByStatus(): array
    {
        return Ticket::select('status', DB::raw('count(*) as count'))
            ->groupBy('status')
            ->pluck('count', 'status')
            ->toArray();
    }

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
