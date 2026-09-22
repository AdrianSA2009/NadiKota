<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('priority_snapshots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ticket_id')->constrained()->cascadeOnDelete();
            $table->decimal('total_score', 10, 4);
            $table->jsonb('factors');
            $table->unsignedInteger('configuration_version');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('priority_snapshots');
    }
};
