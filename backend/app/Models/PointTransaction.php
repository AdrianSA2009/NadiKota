<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\PointTransactionType;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class PointTransaction extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id', 'reward_id', 'points', 'type', 'description',
    ];

    protected function casts(): array
    {
        return [
            'points' => 'integer',
            'type' => PointTransactionType::class,
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function reward(): BelongsTo
    {
        return $this->belongsTo(Reward::class);
    }
}
