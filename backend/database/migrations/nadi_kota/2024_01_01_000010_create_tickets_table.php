<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tickets', function (Blueprint $table) {
            $table->id();
            $table->string('ticket_number')->unique();
            $table->string('category');
            $table->string('status')->default('reported');
            $table->string('review_status')->default('pending');
            $table->decimal('priority_score', 10, 4)->default(0);
            $table->string('priority_label')->default('waiting');
            $table->unsignedBigInteger('assigned_team_id')->nullable();
            $table->timestamp('verified_at')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('sla_due_at')->nullable();
            $table->timestamps();
        });

        DB::statement(<<<'SQL'
            ALTER TABLE tickets
            ADD COLUMN location geometry(Point, 4326) NOT NULL
        SQL);

        DB::statement('CREATE INDEX tickets_location_gist ON tickets USING GIST (location)');

        Schema::table('tickets', function (Blueprint $table) {
            $table->index('status');
            $table->index('category');
            $table->index('created_at');
            $table->index('sla_due_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tickets');
    }
};
