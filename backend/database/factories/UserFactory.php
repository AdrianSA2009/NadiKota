<?php

namespace Database\Factories;

use App\Enums\UserRole;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\User>
 */
class UserFactory extends Factory
{
    protected static ?string $password;

    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'phone' => fake()->unique()->numerify('+628##########'),
            'email' => fake()->unique()->safeEmail(),
            'role' => UserRole::CITIZEN,
            'remember_token' => Str::random(10),
        ];
    }

    public function citizen(): static
    {
        return $this->state(fn (array $attributes) => ['role' => UserRole::CITIZEN]);
    }

    public function admin(): static
    {
        return $this->state(fn (array $attributes) => ['role' => UserRole::ADMIN]);
    }

    public function fieldTeam(): static
    {
        return $this->state(fn (array $attributes) => ['role' => UserRole::FIELD_TEAM]);
    }

    public function superAdmin(): static
    {
        return $this->state(fn (array $attributes) => ['role' => UserRole::SUPER_ADMIN]);
    }
}
