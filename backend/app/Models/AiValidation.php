<?php

namespace App\Models;

use App\Enums\AiDecision;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class AiValidation extends Model
{
    use HasFactory;

    protected $fillable = [
        'report_id', 'result', 'decision', 'confidence',
        'model', 'prompt_version', 'error',
    ];

    protected function casts(): array
    {
        return [
            'decision' => AiDecision::class,
            'result' => 'array',
            'confidence' => 'decimal:4',
        ];
    }

    public function report(): BelongsTo
    {
        return $this->belongsTo(Report::class);
    }
}
