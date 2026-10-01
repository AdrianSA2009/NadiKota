<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Reward;
use Illuminate\Database\Seeder;

class RewardSeeder extends Seeder
{
    public function run(): void
    {
        // icon = nama komponen lucide-react (lihat RewardIconPicker::ICONS)
        $rewards = [
            ['name' => 'Voucher Parkir Rp10.000', 'category' => 'transportasi', 'icon' => 'Car', 'points_cost' => 50, 'stock' => 100],
            ['name' => 'Voucher Angkutan Rp15.000', 'category' => 'transportasi', 'icon' => 'Bus', 'points_cost' => 75, 'stock' => 50],
            ['name' => 'Token Listrik Rp25.000', 'category' => 'tagihan', 'icon' => 'Zap', 'points_cost' => 100, 'stock' => 30],
            ['name' => 'Pulsa Rp10.000', 'category' => 'digital', 'icon' => 'Smartphone', 'points_cost' => 50, 'stock' => 100],
            ['name' => 'Donasi Pohon', 'category' => 'lingkungan', 'icon' => 'Sprout', 'points_cost' => 30, 'stock' => null],
            ['name' => 'Voucher Belanja Rp20.000', 'category' => 'belanja', 'icon' => 'ShoppingBag', 'points_cost' => 80, 'stock' => 40],
        ];

        foreach ($rewards as $reward) {
            Reward::updateOrCreate(['name' => $reward['name']], $reward + ['is_active' => true]);
        }
    }
}
