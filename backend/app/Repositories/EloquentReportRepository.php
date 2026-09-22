<?php

namespace App\Repositories;

use App\Models\Report;
use App\Models\User;
use App\Repositories\Contracts\ReportRepository;
use Illuminate\Support\Facades\DB;

final class EloquentReportRepository implements ReportRepository
{
    public function create(User $user, array $data): Report
    {
        return $user->reports()->create($data);
    }

    public function findNearbyActiveTicket(
        string $category,
        float $latitude,
        float $longitude,
        int $radiusMeters,
    ): ?int {
        $point = "SRID=4326;POINT({$longitude} {$latitude})";

        return DB::table('tickets')
            ->where('category', $category)
            ->whereIn('status', ['reported', 'validated', 'in_queue', 'in_progress'])
            ->whereRaw(
                'ST_DWithin(location::geography, ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography, ?)',
                [$longitude, $latitude, $radiusMeters]
            )
            ->orderByRaw(
                'ST_Distance(location::geography, ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography)',
                [$longitude, $latitude]
            )
            ->value('id');
    }

    public function findNearbyActiveTicketForUser(
        string $category,
        float $latitude,
        float $longitude,
        int $radiusMeters,
        int $userId,
    ): ?int {
        $point = "SRID=4326;POINT({$longitude} {$latitude})";

        return DB::table('tickets')
            ->where('category', $category)
            ->whereIn('status', ['reported', 'validated', 'in_queue', 'in_progress'])
            ->whereRaw(
                'ST_DWithin(location::geography, ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography, ?)',
                [$longitude, $latitude, $radiusMeters]
            )
            ->orderByRaw(
                'ST_Distance(location::geography, ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography)',
                [$longitude, $latitude]
            )
            ->value('id');
    }
}
