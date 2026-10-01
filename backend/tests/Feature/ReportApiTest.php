<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class ReportApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_report_requires_auth(): void
    {
        $response = $this->postJson('/api/v1/reports');
        $response->assertStatus(401);
    }

    public function test_report_validates_fields(): void
    {
        $user = User::factory()->create();
        $response = $this->actingAs($user)
            ->postJson('/api/v1/reports', []);

        $response->assertStatus(422)
            ->assertJsonPath('error.details', fn (array $details) => array_key_exists('category', $details)
                && array_key_exists('latitude', $details)
                && array_key_exists('longitude', $details)
                && array_key_exists('photo', $details)
            );
    }
}
