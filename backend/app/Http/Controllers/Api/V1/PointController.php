<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Reward;
use App\Services\PointService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class PointController extends Controller
{
    public function __construct(private readonly PointService $points) {}

    /**
     * GET /me/points — saldo + riwayat transaksi warga.
     */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        $transactions = $user->pointTransactions()
            ->with('reward:id,name,icon')
            ->latest()
            ->limit(50)
            ->get()
            ->map(fn ($t) => [
                'id' => $t->id,
                'points' => $t->points,
                'type' => $t->type instanceof \BackedEnum ? $t->type->value : $t->type,
                'description' => $t->description,
                'reward' => $t->reward ? ['id' => $t->reward->id, 'name' => $t->reward->name, 'icon' => $t->reward->icon] : null,
                'createdAt' => $t->created_at?->toISOString(),
            ]);

        return response()->json([
            'data' => [
                'balance' => $this->points->balance($user->id),
                'transactions' => $transactions,
            ],
        ]);
    }

    /**
     * GET /rewards — daftar hadiah aktif (publik).
     */
    public function rewards(): JsonResponse
    {
        $rewards = Reward::where('is_active', true)
            ->orderBy('points_cost')
            ->get()
            ->map(fn ($r) => [
                'id' => $r->id,
                'name' => $r->name,
                'description' => $r->description,
                'category' => $r->category,
                'icon' => $r->icon,
                'pointsCost' => $r->points_cost,
                'stock' => $r->stock,
            ]);

        return response()->json(['data' => $rewards]);
    }

    /**
     * POST /rewards/{reward}/redeem — tukar poin (login).
     */
    public function redeem(Request $request, Reward $reward): JsonResponse
    {
        $result = $this->points->redeem($request->user(), $reward);

        if ($result === null) {
            return response()->json([
                'error' => ['message' => 'Poin tidak cukup atau stok hadiah habis.'],
            ], 422);
        }

        return response()->json([
            'data' => [
                'balance' => $result['balance'],
                'pointsCost' => $reward->points_cost,
                'message' => 'Hadiah berhasil ditukar.',
                // Id transaksi klaim — jadi kode QR di halaman Hadiah Saya.
                'transactionId' => $result['transaction']->id,
            ],
        ]);
    }
}
