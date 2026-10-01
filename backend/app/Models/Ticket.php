<?php

namespace App\Models;

use App\Enums\PriorityLabel;
use App\Enums\TicketStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

final class Ticket extends Model
{
    use HasFactory;

    protected $fillable = [
        'ticket_number', 'category', 'status', 'review_status',
        'priority_score', 'priority_label', 'danger_level', 'assigned_team_id', 'assignee_name', 'location',
        'verified_at', 'started_at', 'completed_at', 'cancelled_at', 'cancel_reason', 'proof_note', 'sla_due_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => TicketStatus::class,
            'priority_label' => PriorityLabel::class,
            'priority_score' => 'decimal:4',
            'verified_at' => 'datetime',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'sla_due_at' => 'datetime',
        ];
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->whereNotIn('status', [TicketStatus::COMPLETED, TicketStatus::REJECTED, TicketStatus::CANCELLED]);
    }

    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class, 'assigned_team_id');
    }

    public function reports(): HasMany
    {
        return $this->hasMany(Report::class);
    }

    public function reporters(): HasMany
    {
        return $this->hasMany(TicketReporter::class);
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'ticket_reporters');
    }

    public function photos(): HasMany
    {
        return $this->hasMany(Photo::class);
    }

    public function prioritySnapshots(): HasMany
    {
        return $this->hasMany(PrioritySnapshot::class);
    }

    public function latestPrioritySnapshot(): HasOne
    {
        return $this->hasOne(PrioritySnapshot::class)->latestOfMany();
    }

    public function statusHistories(): HasMany
    {
        return $this->hasMany(TicketStatusHistory::class);
    }

    public function dispatches(): HasMany
    {
        return $this->hasMany(Dispatch::class);
    }

    public function latestDispatch(): HasOne
    {
        return $this->hasOne(Dispatch::class)->latestOfMany();
    }

    public function confirmations(): HasMany
    {
        return $this->hasMany(CitizenConfirmation::class);
    }
}
