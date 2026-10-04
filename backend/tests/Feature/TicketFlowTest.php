<?php

declare(strict_types=1);

use App\Enums\TicketStatus;
use App\Models\Team;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/*
|--------------------------------------------------------------------------
| Alur tiket: bukti → penilaian, SLA, guard PJ, pembatalan, auth email
|--------------------------------------------------------------------------
*/

it('admin menyelesaikan tiket setelah bukti dikirim tim', function (): void {
    $admin = User::factory()->admin()->create();
    // Tim sudah menekan Mulai dan mengirim bukti → review_status submitted.
    $ticket = Ticket::factory()->create([
        'status' => TicketStatus::IN_PROGRESS,
        'review_status' => 'submitted',
    ]);

    // Tanpa foto bukti → ditolak.
    $this->actingAs($admin)
        ->postJson("/api/v1/tickets/{$ticket->id}/finalize")
        ->assertStatus(422);

    $ticket->photos()->create([
        'type' => 'after',
        'object_key' => 'photos/after/test.jpg',
        'sha256' => hash('sha256', 'bukti-uji'),
        'mime_type' => 'image/jpeg',
        'size_bytes' => 1234,
    ]);

    $this->actingAs($admin)
        ->postJson("/api/v1/tickets/{$ticket->id}/finalize")
        ->assertOk()
        ->assertJsonPath('data.status', 'completed');

    expect($ticket->fresh()->status)->toBe(TicketStatus::COMPLETED)
        ->and($ticket->fresh()->review_status)->toBe('approved');
});

it('review menyetujui tiket dan mengisi sla_due_at sesuai kategori', function (): void {
    $admin = User::factory()->admin()->create();

    // pothole → 3 hari (default config)
    $pothole = Ticket::factory()->create(['status' => TicketStatus::NEEDS_REVIEW, 'category' => 'pothole']);
    $this->actingAs($admin)
        ->postJson("/api/v1/tickets/{$pothole->id}/review", ['decision' => 'approved', 'reason' => 'Kerusakan jelas dan mendesak.'])
        ->assertOk()
        ->assertJsonPath('data.status', 'queued');

    $due = $pothole->fresh()->sla_due_at;
    expect($due)->not->toBeNull();
    expect(abs(now()->diffInMinutes($due) - 3 * 24 * 60))->toBeLessThan(2);

    // street_light → 7 hari
    $light = Ticket::factory()->create(['status' => TicketStatus::NEEDS_REVIEW, 'category' => 'street_light']);
    $this->actingAs($admin)
        ->postJson("/api/v1/tickets/{$light->id}/review", ['decision' => 'approved', 'reason' => 'PJU mati dan gelap.'])
        ->assertOk();
    expect(abs(now()->diffInMinutes($light->fresh()->sla_due_at) - 7 * 24 * 60))->toBeLessThan(2);
});

it('tiket ditolak saat review tidak mengisi sla_due_at', function (): void {
    $admin = User::factory()->admin()->create();
    $ticket = Ticket::factory()->create(['status' => TicketStatus::NEEDS_REVIEW]);

    $this->actingAs($admin)
        ->postJson("/api/v1/tickets/{$ticket->id}/review", ['decision' => 'rejected', 'reason' => 'Foto tidak jelas sama sekali.'])
        ->assertOk()
        ->assertJsonPath('data.status', 'rejected');

    expect($ticket->fresh()->sla_due_at)->toBeNull();
});

it('tiket yang sudah dikerjakan tidak bisa dibatalkan', function (): void {
    $admin = User::factory()->admin()->create();
    $ticket = Ticket::factory()->create(['status' => TicketStatus::IN_PROGRESS]);

    $this->actingAs($admin)
        ->postJson("/api/v1/tickets/{$ticket->id}/cancel", ['reason' => 'Batal karena berubah pikiran'])
        ->assertStatus(409);

    expect($ticket->fresh()->status)->toBe(TicketStatus::IN_PROGRESS);
});

it('tiket antrean masih bisa dibatalkan dan sla dibersihkan', function (): void {
    $admin = User::factory()->admin()->create();
    $ticket = Ticket::factory()->create([
        'status' => TicketStatus::QUEUED,
        'sla_due_at' => now()->addDays(3),
    ]);

    $this->actingAs($admin)
        ->postJson("/api/v1/tickets/{$ticket->id}/cancel", ['reason' => 'Laporan terduplikasi warga'])
        ->assertOk()
        ->assertJsonPath('data.status', 'cancelled');

    expect($ticket->fresh()->sla_due_at)->toBeNull();
});

it('PJ tidak bisa diganti selagi tim sedang mengerjakan tiket', function (): void {
    $admin = User::factory()->admin()->create();
    $team = Team::factory()->create();
    // Dua calon PJ berbeda (satu user hanya boleh jadi PJ satu tim).
    $pjAwal = User::factory()->citizen()->create();
    $pjCadangan = User::factory()->citizen()->create();

    $this->actingAs($admin)
        ->patchJson("/api/v1/teams/{$team->id}/leader", ['pj_mode' => 'existing', 'user_id' => $pjAwal->id])
        ->assertOk();

    // Tiket in_progress mengunci PJ → ganti ditolak 409.
    Ticket::factory()->create(['status' => TicketStatus::IN_PROGRESS, 'assigned_team_id' => $team->id]);

    $this->actingAs($admin)
        ->patchJson("/api/v1/teams/{$team->id}/leader", ['pj_mode' => 'existing', 'user_id' => $pjCadangan->id])
        ->assertStatus(409);

    expect($team->fresh()->user_id)->toBe($pjAwal->id);

    // Setelah tugas selesai → bisa ganti ke PJ lain.
    Ticket::query()->update(['status' => TicketStatus::COMPLETED]);
    $this->actingAs($admin)
        ->patchJson("/api/v1/teams/{$team->id}/leader", ['pj_mode' => 'existing', 'user_id' => $pjCadangan->id])
        ->assertOk();

    expect($team->fresh()->user_id)->toBe($pjCadangan->id);
});

it('nama PJ pelaksana tersimpan di tiket dan tidak ikut berubah', function (): void {
    $admin = User::factory()->admin()->create();
    $team = Team::factory()->create();
    // PJ lama harus ber-role field_team dan tercatat sebagai anggota tim.
    $pj = User::factory()->fieldTeam()->create(['name' => 'PJ Lama']);
    $team->update(['user_id' => $pj->id]);
    $team->members()->attach($pj->id, ['role_in_team' => 'leader']);

    $ticket = Ticket::factory()->create(['status' => TicketStatus::QUEUED]);
    $this->actingAs($admin)
        ->postJson("/api/v1/tickets/{$ticket->id}/dispatch", ['team_id' => $team->id])
        ->assertOk();

    expect($ticket->fresh()->assignee_name)->toBe('PJ Lama');

    // Tim mulai → assignee tetap PJ Lama walau PJ diganti sesudahnya.
    $this->actingAs($pj)
        ->postJson("/api/v1/tickets/{$ticket->id}/start")
        ->assertOk();
    expect($ticket->fresh()->assignee_name)->toBe('PJ Lama');
});

it('registrasi memerlukan email dan verifikasi OTP', function (): void {
    \Illuminate\Support\Facades\Mail::fake();

    // Email wajib — renderer error project memakai { error: { details } } (bukan errors).
    $this->postJson('/api/v1/auth/register', [
        'username' => 'wargabaru',
        'name' => 'Warga Baru',
        'password' => 'rahasia123',
        'password_confirmation' => 'rahasia123',
    ])->assertStatus(422)->assertJsonPath('error.details.email.0', 'The email field is required.');

    // Email sudah dipakai: case-insensitive dan whitespace dinormalisasi.
    User::factory()->create(['email' => 'sudah@ada.test']);
    expect(\Illuminate\Support\Facades\DB::selectOne("SELECT indexname FROM pg_indexes WHERE tablename = 'users' AND indexname = 'users_email_lower_unique'"))
        ->not->toBeNull();

    $this->postJson('/api/v1/auth/register', [
        'username' => 'wargabaru',
        'name' => 'Warga Baru',
        'email' => '  SUDAH@ADA.TEST  ',
        'password' => 'rahasia123',
        'password_confirmation' => 'rahasia123',
    ])->assertStatus(422)->assertJsonPath('error.details.email.0', 'Email sudah terdaftar, silakan login atau gunakan email lain.');

    expect(User::whereRaw('LOWER(TRIM(email)) = ?', ['sudah@ada.test'])->count())->toBe(1);

    // Valid → 202, akun BELUM dibuat (menunggu OTP).
    $this->postJson('/api/v1/auth/register', [
        'username' => 'wargabaru',
        'name' => 'Warga Baru',
        'email' => '  BARU@WARGA.TEST  ',
        'password' => 'rahasia123',
        'password_confirmation' => 'rahasia123',
    ])->assertStatus(202)->assertJsonPath('email', 'baru@warga.test');

    $this->assertDatabaseHas('users', ['email' => 'sudah@ada.test']);

    expect(User::where('username', 'wargabaru')->exists())->toBeFalse();

    // OTP salah → ditolak, akun tetap belum ada.
    $this->postJson('/api/v1/auth/register/verify', ['email' => 'baru@warga.test', 'otp' => '000000'])
        ->assertStatus(422);
    expect(User::where('username', 'wargabaru')->exists())->toBeFalse();

    $mail = \Illuminate\Support\Facades\Mail::sent(\App\Mail\RegisterOtpMail::class)->first();
    $this->postJson('/api/v1/auth/register/verify', [
        'email' => '  BARU@WARGA.TEST ',
        'otp' => $mail->otp,
    ])->assertCreated();
    expect(User::where('username', 'wargabaru')->value('email'))->toBe('baru@warga.test');
});

it('update profil bisa mengubah email tapi email dipakai orang lain ditolak', function (): void {
    $user = User::factory()->citizen()->create(['username' => 'warga', 'email' => 'lama@warga.test']);
    User::factory()->create(['email' => 'dipakai@warga.test']);

    $this->actingAs($user)
        ->putJson('/api/v1/me/profile', ['username' => 'warga', 'name' => 'Warga', 'email' => 'dipakai@warga.test'])
        ->assertStatus(422)
        ->assertJsonPath('error.details.email.0', 'Email sudah terdaftar, silakan gunakan email lain.');

    $this->actingAs($user)
        ->putJson('/api/v1/me/profile', ['username' => 'warga', 'name' => 'Warga', 'email' => 'baru@warga.test'])
        ->assertOk()
        ->assertJsonPath('data.user.email', 'baru@warga.test');
});

it('mengembalikan 503 yang jelas jika SMTP gagal mengirim OTP registrasi', function (): void {
    \Illuminate\Support\Facades\Redis::shouldReceive('setex')->twice();
    \Illuminate\Support\Facades\Redis::shouldReceive('del')->once();
    $pendingMail = \Mockery::mock();
    $pendingMail->shouldReceive('send')
        ->once()
        ->andThrow(new \Symfony\Component\Mailer\Exception\TransportException('smtp auth rejected'));
    \Illuminate\Support\Facades\Mail::shouldReceive('to')
        ->once()
        ->with('mailgagal@warga.test')
        ->andReturn($pendingMail);

    $this->postJson('/api/v1/auth/register', [
        'username' => 'mailgagal',
        'name' => 'Warga Baru',
        'email' => 'mailgagal@warga.test',
        'password' => 'rahasia123',
        'password_confirmation' => 'rahasia123',
    ])->assertStatus(503)
        ->assertJsonPath('error.code', 'OTP_EMAIL_UNAVAILABLE')
        ->assertJsonPath('error.message', 'Email verifikasi belum dapat dikirim. Coba lagi nanti atau hubungi administrator.');
});