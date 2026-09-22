<?php

namespace App\Policies;

use App\Enums\TicketStatus;
use App\Enums\UserRole;
use App\Models\Ticket;
use App\Models\User;

final class TicketPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->role === UserRole::ADMIN || $user->role === UserRole::SUPER_ADMIN;
    }

    public function view(User $user, Ticket $ticket): bool
    {
        return $user->role === UserRole::ADMIN || $user->role === UserRole::SUPER_ADMIN;
    }

    public function review(User $user, Ticket $ticket): bool
    {
        return ($user->role === UserRole::ADMIN || $user->role === UserRole::SUPER_ADMIN)
            && $ticket->status === TicketStatus::NEEDS_REVIEW;
    }

    public function dispatch(User $user, Ticket $ticket): bool
    {
        return $user->role === UserRole::ADMIN || $user->role === UserRole::SUPER_ADMIN;
    }

    public function complete(User $user, Ticket $ticket): bool
    {
        return $user->role === UserRole::FIELD_TEAM;
    }

    public function support(User $user, Ticket $ticket): bool
    {
        return $ticket->status->isActive();
    }

    public function confirm(User $user, Ticket $ticket): bool
    {
        return $ticket->users()->where('user_id', $user->id)->exists();
    }
}
