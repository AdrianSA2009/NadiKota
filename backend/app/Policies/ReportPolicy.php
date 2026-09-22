<?php

namespace App\Policies;

use App\Enums\UserRole;
use App\Models\Report;
use App\Models\User;

final class ReportPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->role === UserRole::ADMIN || $user->role === UserRole::SUPER_ADMIN;
    }

    public function view(User $user, Report $report): bool
    {
        return $user->id === $report->user_id
            || $user->role === UserRole::ADMIN
            || $user->role === UserRole::SUPER_ADMIN;
    }

    public function create(User $user): bool
    {
        return true;
    }
}
