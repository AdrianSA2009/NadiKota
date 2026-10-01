<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\PointTransactionType;
use App\Models\PointTransaction;
use App\Models\Reward;
use App\Models\User;
use App\Services\PointService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class PointTest extends TestCase
{
    use RefreshDatabase;

    public function test_points_requires_auth(): void
    {
        $this->getJson('/api/v1/me/points')->assertStatus(401);
        $this->postJson('/api/v1/rewards/1/redeem')->assertStatus(401);
    }

    public function test_earn_and_balance(): void
    {
        $user = User::factory()->citizen()->create();
        $service = app(PointService::class);

        $service->earn($user, 10, 'Laporan diterima: NDI-TEST');
        $service->earn($user, 10, 'Laporan diterima: NDI-TEST2');

        $this->actingAs($user)
            ->getJson('/api/v1/me/points')
            ->assertOk()
            ->assertJsonPath('data.balance', 20)
            ->assertJsonCount(2, 'data.transactions');
    }

    public function test_redeem_deducts_points_and_decrements_stock(): void
    {
        $user = User::factory()->citizen()->create();
        $reward = Reward::create(['name' => 'Voucher Tes', 'category' => 'digital', 'points_cost' => 30, 'stock' => 2, 'is_active' => true]);
        app(PointService::class)->earn($user, 50, 'Laporan diterima');

        $this->actingAs($user)
            ->postJson("/api/v1/rewards/{$reward->id}/redeem")
            ->assertOk()
            ->assertJsonPath('data.balance', 20);

        expect($reward->fresh()->stock)->toBe(1)
            ->and(PointTransaction::where('user_id', $user->id)->sum('points'))->toBe(20);
    }

    public function test_redeem_fails_when_insufficient_points(): void
    {
        $user = User::factory()->citizen()->create();
        $reward = Reward::create(['name' => 'Voucher Mahal', 'category' => 'digital', 'points_cost' => 500, 'stock' => 1, 'is_active' => true]);

        $this->actingAs($user)
            ->postJson("/api/v1/rewards/{$reward->id}/redeem")
            ->assertStatus(422);
    }

    public function test_admin_can_manage_rewards(): void
    {
        $admin = User::factory()->admin()->create();

        $create = $this->actingAs($admin)->postJson('/api/v1/admin/rewards', [
            'name' => 'Voucher Baru',
            'category' => 'belanja',
            'points_cost' => 40,
            'stock' => 10,
        ]);
        $create->assertStatus(201);
        $id = $create->json('data.id');

        $this->actingAs($admin)
            ->putJson("/api/v1/admin/rewards/{$id}", [
                'name' => 'Voucher Baru v2',
                'category' => 'belanja',
                'points_cost' => 45,
                'is_active' => false,
            ])
            ->assertOk()
            ->assertJsonPath('data.id', $id);

        $this->assertDatabaseHas('rewards', ['id' => $id, 'name' => 'Voucher Baru v2', 'is_active' => false]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'update_reward', 'entity_id' => $id]);
    }

    public function test_admin_reward_forbidden_for_citizen(): void
    {
        $citizen = User::factory()->citizen()->create();

        $this->actingAs($citizen)
            ->getJson('/api/v1/admin/rewards')
            ->assertStatus(403);
    }

    public function test_public_rewards_endpoint_lists_active_only(): void
    {
        Reward::create(['name' => 'Aktif', 'category' => 'digital', 'points_cost' => 10, 'is_active' => true]);
        Reward::create(['name' => 'Nonaktif', 'category' => 'digital', 'points_cost' => 20, 'is_active' => false]);

        $this->getJson('/api/v1/rewards')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Aktif');
    }
}
