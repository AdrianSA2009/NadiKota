<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

final class Team extends Model
{
    use HasFactory;

    protected $fillable = ['name', 'district', 'type', 'description', 'user_id', 'is_active'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    /** Penanggung Jawab tim (1 user = 1 tim). */
    public function leader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function tickets(): HasMany
    {
        return $this->hasMany(Ticket::class, 'assigned_team_id');
    }

    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'team_members');
    }

    public function dispatches(): HasMany
    {
        return $this->hasMany(Dispatch::class);
    }
}
