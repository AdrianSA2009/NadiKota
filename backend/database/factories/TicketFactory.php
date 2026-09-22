<?php

namespace Database\Factories;

use App\Enums\PriorityLabel;
use App\Enums\TicketStatus;
use App\Models\Ticket;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Ticket>
 */
class TicketFactory extends Factory
{
    protected $model = Ticket::class;

    public function definition(): array
    {
        return [
            'ticket_number' => strtoupper(fake()->bothify('TK-####-????')),
            'category' => fake()->randomElement(['pothole', 'street_light', 'other']),
            'status' => TicketStatus::REPORTED,
            'review_status' => 'pending',
            'priority_score' => 0,
            'priority_label' => PriorityLabel::WAITING,
        ];
    }
}
