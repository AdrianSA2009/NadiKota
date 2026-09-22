<?php

namespace App\Repositories\Contracts;

use App\Models\Report;

interface ReportRepository
{
    public function create(\App\Models\User $user, array $data): Report;

    public function findNearbyActiveTicket(
        string $category,
        float $latitude,
        float $longitude,
        int $radiusMeters,
    ): ?int;
}
