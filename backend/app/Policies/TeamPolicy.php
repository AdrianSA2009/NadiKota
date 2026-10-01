<?php

declare(strict_types=1);

namespace App\Policies;

use App\Enums\UserRole;
use App\Models\Team;
use App\Models\User;

final class TeamPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->role === UserRole::ADMIN
            || $user->role === UserRole::SUPER_ADMIN
            || $user->role === UserRole::FIELD_TEAM;
    }

    public function view(User $user, Team $team): bool
    {
        if ($user->role === UserRole::ADMIN || $user->role === UserRole::SUPER_ADMIN) {
            return true;
        }

        // Field team hanya boleh melihat timnya sendiri.
        return $user->teams()->whereKey($team->id)->exists();
    }

    /** Aksi manajemen tim (buat/edit/ganti PJ/reset password/nonaktif) — Admin saja. */
    public function manage(User $user, ?Team $team = null): bool
    {
        return $user->role === UserRole::ADMIN || $user->role === UserRole::SUPER_ADMIN;
    }
}
