<?php

namespace Database\Factories;

use App\Models\Photo;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Photo>
 */
class PhotoFactory extends Factory
{
    protected $model = Photo::class;

    public function definition(): array
    {
        return [
            'type' => 'before',
            'object_key' => 'photos/' . fake()->uuid() . '.jpg',
            'sha256' => hash('sha256', random_bytes(100)),
            'mime_type' => 'image/jpeg',
            'size_bytes' => fake()->numberBetween(50000, 500000),
        ];
    }
}
