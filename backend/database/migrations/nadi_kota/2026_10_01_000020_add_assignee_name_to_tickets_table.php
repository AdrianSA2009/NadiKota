<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            // Snapshot nama PJ yang melaksanakan tiket — tetap meski PJ tim diganti.
            $table->string('assignee_name', 100)->nullable()->after('assigned_team_id');
        });
    }

    public function down(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->dropColumn('assignee_name');
        });
    }
};
