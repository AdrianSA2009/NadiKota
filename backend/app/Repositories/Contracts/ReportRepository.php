<?php

namespace App\Repositories\Contracts;

use App\Models\Report;
use App\Models\User;

interface ReportRepository
{
    public function create(User $user, array $data): Report;

    public function findNearbyActiveTicket(
        string $category,
        float $latitude,
        float $longitude,
        int $radiusMeters,
    ): ?int;
}
