<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('citizen_confirmations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ticket_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->boolean('confirmed');
            $table->text('note')->nullable();
            $table->timestamps();
            $table->unique(['ticket_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('citizen_confirmations');
    }
};
