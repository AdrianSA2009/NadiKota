<?php

namespace App\Console\Commands;

use App\Services\PriorityService;
use Illuminate\Console\Command;

class RecomputePriorityScores extends Command
{
    protected $signature = 'nadi:recompute-priority';

    protected $description = 'Recompute priority scores for all active tickets (factors: age, severity, etc.)';

    public function handle(PriorityService $priorityService): int
    {
        $this->info('Recomputing priority scores for active tickets...');

        $count = $priorityService->recomputeAllActiveTickets();

        $this->info("Done. {$count} tickets recomputed.");

        return self::SUCCESS;
    }
}
