<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tickets', function (Blueprint $table): void {
            // Alasan admin saat menolak bukti hasil perbaikan (ditampilkan ke tim untuk kirim ulang).
            $table->text('proof_note')->nullable()->after('cancel_reason');
        });
    }

    public function down(): void
    {
        Schema::table('tickets', function (Blueprint $table): void {
            $table->dropColumn('proof_note');
        });
    }
};
