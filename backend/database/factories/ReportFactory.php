<?php

namespace Database\Factories;

use App\Enums\ReportCategory;
use App\Enums\ReportStatus;
use App\Models\Report;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Report>
 */
class ReportFactory extends Factory
{
    protected $model = Report::class;

    public function definition(): array
    {
        return [
            'user_id' => \App\Models\User::factory(),
            'category' => ReportCategory::POTHOLE,
            'status' => ReportStatus::SUBMITTED,
            'latitude' => 1.1191,
            'longitude' => 104.0538,
            'idempotency_key' => fake()->uuid(),
            'server_captured_at' => now(),
        ];
    }
}
