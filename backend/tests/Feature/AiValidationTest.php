<?php

use App\Enums\ReportStatus;
use App\Enums\TicketStatus;
use App\Jobs\ValidateReportImage;
use App\Models\AiValidation;
use App\Models\Photo;
use App\Models\Report;
use App\Models\Ticket;
use App\Models\User;
use App\Services\Contracts\AiImageValidator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

it('dispatches ValidateReportImage job when report is created', function (): void
{
    Queue::fake();

    $user = User::factory()->citizen()->create();

    $response = $this->actingAs($user)
        ->postJson('/api/v1/reports', [
            'category' => 'pothole',
            'latitude' => 1.1191,
            'longitude' => 104.0538,
            'photo' => \Illuminate\Http\UploadedFile::fake()->image('pothole.jpg'),
        ], [
            'Idempotency-Key' => uniqid('test-', true),
        ]);

    $response->assertStatus(201);

    Queue::assertPushed(ValidateReportImage::class, function ($job) {
        return true;
    });
});

it('validates report with accepted decision', function (): void
{
    $user = User::factory()->citizen()->create();
    $ticket = Ticket::factory()->create(['status' => TicketStatus::REPORTED]);
    $report = Report::factory()->create([
        'user_id' => $user->id,
        'ticket_id' => $ticket->id,
        'status' => ReportStatus::SUBMITTED,
    ]);
    Photo::factory()->create([
        'report_id' => $report->id,
        'type' => 'before',
    ]);

    $mockValidator = Mockery::mock(AiImageValidator::class);
    $mockValidator->shouldReceive('validate')->once()->andReturn([
        'result' => [
            'feasibility' => 'valid',
            'category' => 'pothole',
            'severity' => 'moderate',
            'confidence' => 0.85,
            'reason' => 'Foto jelas menunjukkan jalan berlubang.',
        ],
        'decision' => 'accepted',
        'confidence' => 0.85,
        'model' => 'gpt-4o-mini',
        'prompt_version' => 'v1.0',
    ]);

    $this->app->bind(AiImageValidator::class, fn () => $mockValidator);

    ValidateReportImage::dispatchSync($report->id);

    $report->refresh();
    expect($report->status)->toBe(ReportStatus::VALIDATED);

    $this->assertDatabaseHas('ai_validations', [
        'report_id' => $report->id,
        'decision' => 'accepted',
        'confidence' => 0.85,
    ]);
});

it('validates report with rejected decision', function (): void
{
    $user = User::factory()->citizen()->create();
    $ticket = Ticket::factory()->create(['status' => TicketStatus::REPORTED]);
    $report = Report::factory()->create([
        'user_id' => $user->id,
        'ticket_id' => $ticket->id,
        'status' => ReportStatus::SUBMITTED,
    ]);
    Photo::factory()->create([
        'report_id' => $report->id,
        'type' => 'before',
    ]);

    $mockValidator = Mockery::mock(AiImageValidator::class);
    $mockValidator->shouldReceive('validate')->once()->andReturn([
        'result' => [
            'feasibility' => 'invalid',
            'category' => 'other',
            'severity' => 'low',
            'confidence' => 0.2,
            'reason' => 'Foto tidak menunjukkan kerusakan infrastruktur.',
        ],
        'decision' => 'rejected',
        'confidence' => 0.2,
        'model' => 'gpt-4o-mini',
        'prompt_version' => 'v1.0',
    ]);

    $this->app->bind(AiImageValidator::class, fn () => $mockValidator);

    ValidateReportImage::dispatchSync($report->id);

    $report->refresh();
    expect($report->status)->toBe(ReportStatus::REJECTED);
    expect($report->rejection_reason)->not->toBeNull();

    $this->assertDatabaseHas('ai_validations', [
        'report_id' => $report->id,
        'decision' => 'rejected',
    ]);
});

it('validates report with suspicious decision', function (): void
{
    $user = User::factory()->citizen()->create();
    $ticket = Ticket::factory()->create(['status' => TicketStatus::REPORTED]);
    $report = Report::factory()->create([
        'user_id' => $user->id,
        'ticket_id' => $ticket->id,
        'status' => ReportStatus::SUBMITTED,
    ]);
    Photo::factory()->create([
        'report_id' => $report->id,
        'type' => 'before',
    ]);

    $mockValidator = Mockery::mock(AiImageValidator::class);
    $mockValidator->shouldReceive('validate')->once()->andReturn([
        'result' => [
            'feasibility' => 'uncertain',
            'category' => 'pothole',
            'severity' => 'low',
            'confidence' => 0.5,
            'reason' => 'Foto agak relevan tapi kurang jelas.',
        ],
        'decision' => 'suspicious',
        'confidence' => 0.5,
        'model' => 'gpt-4o-mini',
        'prompt_version' => 'v1.0',
    ]);

    $this->app->bind(AiImageValidator::class, fn () => $mockValidator);

    ValidateReportImage::dispatchSync($report->id);

    $report->refresh();
    expect($report->status)->toBe(ReportStatus::NEEDS_REVIEW);

    $this->assertDatabaseHas('ai_validations', [
        'report_id' => $report->id,
        'decision' => 'suspicious',
    ]);
});

it('handles AI validation failure gracefully', function (): void
{
    $user = User::factory()->citizen()->create();
    $ticket = Ticket::factory()->create(['status' => TicketStatus::REPORTED]);
    $report = Report::factory()->create([
        'user_id' => $user->id,
        'ticket_id' => $ticket->id,
        'status' => ReportStatus::SUBMITTED,
    ]);
    Photo::factory()->create([
        'report_id' => $report->id,
        'type' => 'before',
    ]);

    $mockValidator = Mockery::mock(AiImageValidator::class);
    $mockValidator->shouldReceive('validate')->once()->andThrow(new \RuntimeException('API timeout'));

    $this->app->bind(AiImageValidator::class, fn () => $mockValidator);

    ValidateReportImage::dispatchSync($report->id);

    $report->refresh();
    expect($report->status)->toBe(ReportStatus::NEEDS_REVIEW);

    $this->assertDatabaseHas('ai_validations', [
        'report_id' => $report->id,
        'decision' => 'suspicious',
        'error' => 'API timeout',
    ]);
});

it('updates ticket status when report is accepted', function (): void
{
    $user = User::factory()->citizen()->create();
    $ticket = Ticket::factory()->create(['status' => TicketStatus::REPORTED]);
    $report = Report::factory()->create([
        'user_id' => $user->id,
        'ticket_id' => $ticket->id,
        'status' => ReportStatus::SUBMITTED,
    ]);
    Photo::factory()->create([
        'report_id' => $report->id,
        'type' => 'before',
    ]);

    $mockValidator = Mockery::mock(AiImageValidator::class);
    $mockValidator->shouldReceive('validate')->once()->andReturn([
        'result' => [
            'feasibility' => 'valid',
            'category' => 'pothole',
            'severity' => 'high',
            'confidence' => 0.9,
            'reason' => 'Jalan berlubang besar.',
        ],
        'decision' => 'accepted',
        'confidence' => 0.9,
        'model' => 'gpt-4o-mini',
        'prompt_version' => 'v1.0',
    ]);

    $this->app->bind(AiImageValidator::class, fn () => $mockValidator);

    ValidateReportImage::dispatchSync($report->id);

    $ticket->refresh();
    expect($ticket->status)->toBe(TicketStatus::VALIDATED);
    expect($ticket->verified_at)->not->toBeNull();

    $this->assertDatabaseHas('ticket_status_histories', [
        'ticket_id' => $ticket->id,
        'from_status' => 'reported',
        'to_status' => 'validated',
    ]);
});
