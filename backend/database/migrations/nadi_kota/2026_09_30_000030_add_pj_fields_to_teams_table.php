<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('teams', function (Blueprint $table): void {
            // Penanggung Jawab tim — 1 user = 1 tim (unik). Nullable: tim lama boleh tanpa PJ.
            $table->foreignId('user_id')->nullable()->unique()->after('id')
                ->constrained('users')->nullOnDelete();
            $table->string('type')->nullable()->after('district');
            $table->text('description')->nullable()->after('type');
        });
    }

    public function down(): void
    {
        Schema::table('teams', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('user_id');
            $table->dropColumn(['type', 'description']);
        });
    }
};
