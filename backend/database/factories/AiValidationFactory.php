<?php

namespace Database\Factories;

use App\Enums\AiDecision;
use App\Models\AiValidation;
use App\Models\Report;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<AiValidation>
 */
class AiValidationFactory extends Factory
{
    protected $model = AiValidation::class;

    public function definition(): array
    {
        return [
            'report_id' => Report::factory(),
            'result' => ['feasibility' => 'valid', 'category' => 'pothole', 'severity' => 'moderate', 'confidence' => 0.85],
            'decision' => AiDecision::ACCEPTED,
            'confidence' => 0.85,
            'model' => 'gpt-4o-mini',
            'prompt_version' => 'v1.0',
        ];
    }
}
