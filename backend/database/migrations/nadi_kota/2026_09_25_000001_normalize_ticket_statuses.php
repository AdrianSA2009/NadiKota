<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('tickets')->whereIn('status', ['validated', 'in_queue'])->update(['status' => 'queued']);

        DB::table('ticket_status_histories')->where('from_status', 'validated')->update(['from_status' => 'queued']);
        DB::table('ticket_status_histories')->where('to_status', 'validated')->update(['to_status' => 'queued']);
        DB::table('ticket_status_histories')->where('from_status', 'in_queue')->update(['from_status' => 'queued']);
        DB::table('ticket_status_histories')->where('to_status', 'in_queue')->update(['to_status' => 'queued']);
    }

    public function down(): void
    {
        // Legacy values collapse into `queued`, so reverse mapping would lose state.
    }
};
