<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class PrioritySnapshot extends Model
{
    protected $fillable = [
        'ticket_id', 'total_score', 'factors', 'configuration_version',
    ];

    protected function casts(): array
    {
        return [
            'total_score' => 'decimal:4',
            'factors' => 'array',
            'configuration_version' => 'integer',
        ];
    }

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(Ticket::class);
    }
}
