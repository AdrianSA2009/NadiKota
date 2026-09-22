<?php

namespace Database\Factories;

use App\Models\Team;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Team>
 */
class TeamFactory extends Factory
{
    protected $model = Team::class;

    public function definition(): array
    {
        return [
            'name' => 'Tim ' . fake()->citySuffix() . ' ' . fake()->randomLetter(),
            'district' => fake()->city(),
            'is_active' => true,
        ];
    }
}
