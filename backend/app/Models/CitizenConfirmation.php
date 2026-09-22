<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class CitizenConfirmation extends Model
{
    protected $fillable = ['ticket_id', 'user_id', 'confirmed', 'note'];

    protected function casts(): array
    {
        return ['confirmed' => 'boolean'];
    }

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(Ticket::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
