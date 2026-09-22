<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('road_segments', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('road_class')->default('local');
            $table->string('district')->nullable();
            $table->timestamps();
        });

        DB::statement(<<<'SQL'
            ALTER TABLE road_segments
            ADD COLUMN geometry geometry(LineString, 4326)
        SQL);

        DB::statement('CREATE INDEX road_segments_geometry_gist ON road_segments USING GIST (geometry)');
    }

    public function down(): void
    {
        Schema::dropIfExists('road_segments');
    }
};
