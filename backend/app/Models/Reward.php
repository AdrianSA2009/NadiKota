<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

final class Reward extends Model
{
    use HasFactory;

    protected $fillable = [
        'name', 'description', 'category', 'icon',
        'points_cost', 'stock', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'points_cost' => 'integer',
            'stock' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public function redemptions(): HasMany
    {
        return $this->hasMany(PointTransaction::class);
    }
}
