<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('critical_facilities', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('facility_type');
            $table->timestamps();
        });

        DB::statement(<<<'SQL'
            ALTER TABLE critical_facilities
            ADD COLUMN location geometry(Point, 4326) NOT NULL
        SQL);

        DB::statement('CREATE INDEX critical_facilities_location_gist ON critical_facilities USING GIST (location)');
    }

    public function down(): void
    {
        Schema::dropIfExists('critical_facilities');
    }
};
