<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('priority_configurations', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('version');
            $table->jsonb('weights');
            $table->decimal('clustering_radius_meters', 5, 2)->default(20);
            $table->decimal('ai_accepted_threshold', 5, 4)->default(0.7);
            $table->decimal('ai_rejected_threshold', 5, 4)->default(0.3);
            $table->boolean('is_active')->default(false);
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique('version');
            $table->index('is_active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('priority_configurations');
    }
};
