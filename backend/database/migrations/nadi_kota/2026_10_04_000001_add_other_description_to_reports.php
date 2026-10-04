<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('reports', 'other_description')) {
            return;
        }

        Schema::table('reports', function (Blueprint $table) {
            // Keterangan singkat untuk laporan kategori "other" (bukan jalan berlubang / PJU mati).
            $table->string('other_description', 500)->nullable()->after('category');
        });
    }

    public function down(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->dropColumn('other_description');
        });
    }
};