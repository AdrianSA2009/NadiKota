<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Reward;
use App\Services\RewardIconPicker;
use App\Services\RewardDescriptionGenerator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class RewardController extends Controller
{
    /**
     * GET /admin/rewards — semua hadiah (termasuk non-aktif).
     */
    public function index(): JsonResponse
    {
        $rewards = Reward::orderBy('points_cost')->get()->map(fn ($r) => [
            'id' => $r->id,
            'name' => $r->name,
            'description' => $r->description,
            'category' => $r->category,
            'icon' => $r->icon,
            'pointsCost' => $r->points_cost,
            'stock' => $r->stock,
            'isActive' => $r->is_active,
            'createdAt' => $r->created_at?->toISOString(),
        ]);

        return response()->json(['data' => $rewards]);
    }

    /**
     * POST /admin/rewards — buat hadiah baru.
     */
    public function store(Request $request, RewardIconPicker $iconPicker): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|min:2|max:100',
            'description' => 'nullable|string|max:500',
            'category' => 'required|string|in:transportasi,tagihan,digital,lingkungan,belanja,lainnya',
            'icon' => 'nullable|string|max:32',
            'points_cost' => 'required|integer|min:1|max:100000',
            'stock' => 'nullable|integer|min:0',
            'is_active' => 'boolean',
        ]);

        // Icon ditentukan otomatis oleh AI bila tidak dikirim
        if (empty($data['icon'])) {
            $data['icon'] = $iconPicker->pick($data['name'], $data['description'] ?? null);
        }

        $reward = Reward::create($data);

        $this->audit($request, 'create_reward', $reward->id, null, $data);

        return response()->json(['data' => ['id' => $reward->id]], 201);
    }

    /**
     * PUT /admin/rewards/{reward} — ubah hadiah.
     */
    public function update(Request $request, Reward $reward): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|min:2|max:100',
            'description' => 'nullable|string|max:500',
            'category' => 'required|string|in:transportasi,tagihan,digital,lingkungan,belanja,lainnya',
            'icon' => 'nullable|string|max:32',
            'points_cost' => 'required|integer|min:1|max:100000',
            'stock' => 'nullable|integer|min:0',
            'is_active' => 'boolean',
        ]);

        $before = $reward->toArray();
        $reward->update($data);

        $this->audit($request, 'update_reward', $reward->id, $before, $data);

        return response()->json(['data' => ['id' => $reward->id]]);
    }

    /**
     * DELETE /admin/rewards/{reward} — hapus hadiah (non-aktifkan bila sudah pernah ditukar).
     */
    public function destroy(Request $request, Reward $reward): JsonResponse
    {
        if ($reward->redemptions()->exists()) {
            $reward->update(['is_active' => false]);
            $this->audit($request, 'deactivate_reward', $reward->id, ['is_active' => true], ['is_active' => false]);

            return response()->json(['data' => ['id' => $reward->id, 'deactivated' => true]]);
        }

        $this->audit($request, 'delete_reward', $reward->id, $reward->toArray(), null);
        $reward->delete();

        return response()->json(['data' => ['id' => $reward->id, 'deactivated' => false]]);
    }

    /**
     * POST /admin/rewards/generate-description — buat deskripsi hadiah oleh AI.
     */
    public function generateDescription(Request $request, RewardDescriptionGenerator $generator): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|min:2|max:100',
        ]);

        $description = $generator->generate($data['name']);

        return response()->json(['description' => $description]);
    }

    private function audit(Request $request, string $action, int $entityId, ?array $before, ?array $after): void
    {
        AuditLog::create([
            'actor_id' => $request->user()->id,
            'action' => $action,
            'entity_type' => Reward::class,
            'entity_id' => $entityId,
            'before' => $before,
            'after' => $after,
            'request_id' => $request->header('X-Request-Id'),
        ]);
    }
}
