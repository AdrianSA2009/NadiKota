<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->text('rejection_reason')->nullable()->after('status');
            $table->text('rejection_suggestion')->nullable()->after('rejection_reason');
        });
    }

    public function down(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->dropColumn(['rejection_reason', 'rejection_suggestion']);
        });
    }
};
