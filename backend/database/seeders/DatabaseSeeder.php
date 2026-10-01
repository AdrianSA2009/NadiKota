<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\Team;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        User::updateOrCreate(['username' => 'admin'], [
            'name' => 'Admin NadiKota',
            'role' => UserRole::ADMIN,
            'password' => Hash::make('admin1234'),
        ]);

        User::factory()->superAdmin()->create([
            'name' => 'Super Admin NadiKota',
            'email' => 'superadmin@nadikota.go.id',
        ]);

        User::factory()->admin()->count(3)->create();
        User::factory()->fieldTeam()->count(5)->create();
        User::factory()->citizen()->count(10)->create();

        $teams = [
            ['name' => 'Tim Pemeliharaan Jalan Batam Center', 'district' => 'Batam Center'],
            ['name' => 'Tim PJU Batu Aji', 'district' => 'Batu Aji'],
            ['name' => 'Tim Pemeliharaan Jalan Sekupang', 'district' => 'Sekupang'],
        ];

        foreach ($teams as $teamData) {
            $team = Team::factory()->create($teamData);
            $fieldTeamUsers = User::where('role', UserRole::FIELD_TEAM)->take(2)->get();
            $team->members()->attach($fieldTeamUsers);
        }

        $this->call(RewardSeeder::class);
    }
}
