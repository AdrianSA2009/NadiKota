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
        if ($ticket->status !== TicketStatus::IN_PROGRESS) {
            return false;
        }

        if ($user->role === UserRole::ADMIN || $user->role === UserRole::SUPER_ADMIN) {
            return true;
        }

        return $user->role === UserRole::FIELD_TEAM
            && $ticket->team?->members()->whereKey($user->id)->exists();
    }

    /** Finalisasi (verifikasi bukti) — hanya admin. */
    public function finalize(User $user, Ticket $ticket): bool
    {
        return $user->role === UserRole::ADMIN || $user->role === UserRole::SUPER_ADMIN;
    }

    /** Penolakan bukti hasil perbaikan — hanya admin. */
    public function rejectProof(User $user, Ticket $ticket): bool
    {
        return $user->role === UserRole::ADMIN || $user->role === UserRole::SUPER_ADMIN;
    }

    /** Tim menekan "Mulai" — anggota tim yang ditugaskan atau admin. */
    public function start(User $user, Ticket $ticket): bool
    {
        if ($user->role === UserRole::ADMIN || $user->role === UserRole::SUPER_ADMIN) {
            return true;
        }

        return $user->role === UserRole::FIELD_TEAM
            && $ticket->assigned_team_id !== null
            && $ticket->team?->members()->whereKey($user->id)->exists();
    }

    public function cancel(User $user, Ticket $ticket): bool
    {
        return ($user->role === UserRole::ADMIN || $user->role === UserRole::SUPER_ADMIN)
            && $ticket->status->isActive();
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
