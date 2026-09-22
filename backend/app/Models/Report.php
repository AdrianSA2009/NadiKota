<?php

namespace App\Models;

use App\Enums\ReportCategory;
use App\Enums\ReportStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

final class Report extends Model
{
    protected $fillable = [
        'user_id', 'ticket_id', 'category', 'status',
        'latitude', 'longitude', 'idempotency_key', 'server_captured_at',
    ];

    protected function casts(): array
    {
        return [
            'category' => ReportCategory::class,
            'status' => ReportStatus::class,
            'server_captured_at' => 'datetime',
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(Ticket::class);
    }

    public function aiValidations(): HasMany
    {
        return $this->hasMany(AiValidation::class);
    }

    public function latestAiValidation(): HasOne
    {
        return $this->hasOne(AiValidation::class)->latestOfMany();
    }

    public function photos(): HasMany
    {
        return $this->hasMany(Photo::class);
    }
}
