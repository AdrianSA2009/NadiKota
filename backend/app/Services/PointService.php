<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\PointTransactionType;
use App\Models\PointTransaction;
use App\Models\Reward;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Poin warga: diperoleh dari laporan yang diterima, ditukar dengan hadiah.
 * Saldo = SUM(point_transactions.points).
 */
final class PointService
{
    public function balance(int $userId): int
    {
        return (int) PointTransaction::where('user_id', $userId)->sum('points');
    }

    public function earn(User $user, int $points, string $description): PointTransaction
    {
        return PointTransaction::create([
            'user_id' => $user->id,
            'points' => $points,
            'type' => PointTransactionType::EARN,
            'description' => $description,
        ]);
    }

    /**
     * Tukar poin dengan hadiah. Mengembalikan null jika gagal (saldo kurang / stok habis).
     *
     * @return array{transaction: PointTransaction, balance: int}|null
     */
    public function redeem(User $user, Reward $reward): ?array
    {
        return DB::transaction(function () use ($user, $reward) {
            $balance = $this->balance($user->id);
            if ($balance < $reward->points_cost) {
                return null;
            }

            if ($reward->stock !== null && $reward->stock < 1) {
                return null;
            }

            if ($reward->stock !== null) {
                $reward->decrement('stock');
            }

            $transaction = PointTransaction::create([
                'user_id' => $user->id,
                'reward_id' => $reward->id,
                'points' => -$reward->points_cost,
                'type' => PointTransactionType::REDEEM,
                'description' => 'Tukar: ' . $reward->name,
            ]);

            return [
                'transaction' => $transaction,
                'balance' => $this->balance($user->id),
            ];
        });
    }
}
