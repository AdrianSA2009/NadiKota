<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class PriorityConfiguration extends Model
{
    protected $fillable = [
        'version', 'weights', 'clustering_radius_meters',
        'ai_accepted_threshold', 'ai_rejected_threshold',
        'is_active', 'actor_id',
    ];

    protected function casts(): array
    {
        return [
            'weights' => 'array',
            'clustering_radius_meters' => 'decimal:2',
            'ai_accepted_threshold' => 'decimal:4',
            'ai_rejected_threshold' => 'decimal:4',
            'is_active' => 'boolean',
            'version' => 'integer',
        ];
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}
