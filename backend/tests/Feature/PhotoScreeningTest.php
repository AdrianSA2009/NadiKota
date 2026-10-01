<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Jobs\ScreenReportPhoto;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

final class PhotoScreeningTest extends TestCase
{
    use RefreshDatabase;

    public function test_screening_requires_auth(): void
    {
        $this->postJson('/api/v1/photo-screening')->assertStatus(401);
    }

    public function test_screening_dispatches_job_and_returns_check_id(): void
    {
        Queue::fake();
        $user = User::factory()->citizen()->create();

        $response = $this->actingAs($user)->post('/api/v1/photo-screening', [
            'photo' => UploadedFile::fake()->image('jalan.jpg'),
        ]);

        $response->assertStatus(202)->assertJsonStructure(['data' => ['checkId']]);
        Queue::assertPushed(ScreenReportPhoto::class);

        $checkId = $response->json('data.checkId');
        $this->getJson("/api/v1/photo-screening/{$checkId}")->assertJsonPath('data.status', 'pending');
    }

    public function test_screening_rejects_invalid_photo(): void
    {
        $user = User::factory()->citizen()->create();

        $this->actingAs($user)
            ->post('/api/v1/photo-screening', ['photo' => UploadedFile::fake()->create('doc.pdf')])
            ->assertStatus(422);
    }

    public function test_screening_returns_done_result_from_cache(): void
    {
        $checkId = '11111111-1111-4111-8111-111111111111';
        Cache::put('photo-screen:' . $checkId, [
            'status' => 'done',
            'ok' => true,
            'category' => 'pothole',
            'severity' => 'high',
        ], 600);

        $this->getJson("/api/v1/photo-screening/{$checkId}")
            ->assertOk()
            ->assertJsonPath('data.status', 'done')
            ->assertJsonPath('data.category', 'pothole')
            ->assertJsonPath('data.severity', 'high');
    }
}
