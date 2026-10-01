<?php

declare(strict_types=1);

use App\Enums\TicketStatus;
use App\Models\Team;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('admin dapat membuat tim beserta akun PJ baru', function (): void {
    $admin = User::factory()->admin()->create();

    $this->actingAs($admin)
        ->postJson('/api/v1/teams', [
            'name' => 'Tim Uji Batam Center',
            'district' => 'Batam Center',
            'type' => 'Pemeliharaan Jalan',
            'pj_mode' => 'new',
            'pj_name' => 'PJ Uji',
            'pj_username' => 'pjuji',
            'pj_password' => 'rahasia123',
        ])
        ->assertCreated()
        ->assertJsonPath('data.status', 'tersedia')
        ->assertJsonPath('data.leader.name', 'PJ Uji');

    $pj = User::where('username', 'pjuji')->first();
    expect($pj)->not->toBeNull()
        ->and($pj->role->value)->toBe('field_team');

    $team = Team::where('name', 'Tim Uji Batam Center')->first();
    expect($team->user_id)->toBe($pj->id);
    expect($team->members()->whereKey($pj->id)->exists())->toBeTrue();
});

it('warga tidak boleh mengelola tim', function (): void {
    $citizen = User::factory()->citizen()->create();

    $this->actingAs($citizen)
        ->postJson('/api/v1/teams', ['name' => 'Tim Dilarang', 'district' => 'Sekupang'])
        ->assertForbidden();
});

it('satu user hanya boleh menjadi PJ satu tim', function (): void {
    $admin = User::factory()->admin()->create();
    $citizen = User::factory()->citizen()->create();

    $this->actingAs($admin)
        ->postJson('/api/v1/teams', [
            'name' => 'Tim Pertama',
            'district' => 'Batu Aji',
            'pj_mode' => 'existing',
            'user_id' => $citizen->id,
        ])
        ->assertCreated();

    $second = $this->actingAs($admin)
        ->postJson('/api/v1/teams', [
            'name' => 'Tim Kedua',
            'district' => 'Sekupang',
            'pj_mode' => 'existing',
            'user_id' => $citizen->id,
        ]);

    // Renderer error project memakai bentuk { error: { code, message, details } } (key di-camelCase).
    $second
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'ValidationException')
        ->assertJsonPath('error.details.userId.0', 'User tersebut sudah menjadi PJ tim lain. Satu user hanya boleh menjadi PJ satu tim.');

    expect($citizen->fresh()->role->value)->toBe('field_team');
});

it('menonaktifkan tim yang memegang tiket aktif ditolak', function (): void {
    $admin = User::factory()->admin()->create();
    $team = Team::factory()->create();
    $ticket = Ticket::factory()->create([
        'status' => TicketStatus::IN_PROGRESS,
        'assigned_team_id' => $team->id,
    ]);

    $this->actingAs($admin)
        ->patchJson("/api/v1/teams/{$team->id}/deactivate")
        ->assertStatus(422);

    expect($team->fresh()->is_active)->toBeTrue();

    $ticket->update(['status' => TicketStatus::COMPLETED, 'assigned_team_id' => null]);

    $this->actingAs($admin)
        ->patchJson("/api/v1/teams/{$team->id}/deactivate")
        ->assertOk()
        ->assertJsonPath('data.isActive', false)
        ->assertJsonPath('data.status', 'nonaktif');
});

it('tiket yang sama tidak bisa didispatch dua kali', function (): void {
    $admin = User::factory()->admin()->create();
    $team = Team::factory()->create();
    $ticket = Ticket::factory()->create(['status' => TicketStatus::QUEUED]);

    $this->actingAs($admin)
        ->postJson("/api/v1/tickets/{$ticket->id}/dispatch", ['team_id' => $team->id])
        ->assertOk()
        ->assertJsonPath('data.status', 'queued'); // penugasan belum dikerjakan — tim harus tekan "Mulai"

    // Dispatch ulang (tim sama) ditolak — mencegah dua admin bersamaan.
    $this->actingAs($admin)
        ->postJson("/api/v1/tickets/{$ticket->id}/dispatch", ['team_id' => $team->id])
        ->assertStatus(409);
});
