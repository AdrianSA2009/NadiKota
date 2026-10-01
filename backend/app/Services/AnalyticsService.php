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
        $cacheKey = 'analytics:summary:v2';
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
            'unique_reporters' => DB::table('reports')->distinct()->count('user_id'),
            'sla_escalated' => Ticket::whereIn('status', [
                    TicketStatus::REPORTED->value,
                    TicketStatus::VERIFIED->value,
                    TicketStatus::QUEUED->value,
                    TicketStatus::IN_PROGRESS->value,
                    TicketStatus::NEEDS_REVIEW->value,
                ])
                ->where('created_at', '<', now()->subDays(3))
                ->count(),
            'chart' => $this->getReportChart(14),
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

    /** Grafik batang pelaporan: jumlah laporan per hari (N hari terakhir, termasuk hari tanpa laporan). */
    private function getReportChart(int $days): array
    {
        $from = now()->subDays($days - 1)->startOfDay();
        $counts = DB::table('reports')
            ->where('created_at', '>=', $from)
            ->selectRaw('date(created_at) as day, count(*) as count')
            ->groupBy('day')
            ->pluck('count', 'day')
            ->toArray();

        $chart = [];
        for ($i = 0; $i < $days; $i++) {
            $key = now()->subDays($days - 1 - $i)->format('Y-m-d');
            $chart[] = ['date' => $key, 'count' => (int) ($counts[$key] ?? 0)];
        }

        return $chart;
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
