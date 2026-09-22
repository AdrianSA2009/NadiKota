<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

final class ReportApiTest extends TestCase
{
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
            ->assertJsonValidationErrors(['category', 'latitude', 'longitude', 'photo']);
    }
}
