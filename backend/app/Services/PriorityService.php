<?php

namespace App\Services;

use App\Models\PriorityConfiguration;
use App\Models\Ticket;
use Illuminate\Support\Facades\DB;

class PriorityService
{
    /**
     * Hitung skor prioritas deterministik dari 5 faktor.
     * Tidak ada input AI (L-01).
     */
    public function calculatePriorityScore(Ticket $ticket): float
    {
        $config = $this->getActiveConfiguration();
        $weights = $config->weights;

        $factors = [];
        $totalScore = 0.0;

        // Faktor 1: Keparahan (dari AI validation terakhir)
        $severityScore = $this->getSeverityScore($ticket);
        $factors['severity'] = $severityScore;
        $totalScore += $severityScore * ($weights['severity'] ?? 30) / 100;

        // Faktor 2: Jumlah pelapor unik
        $reporterCount = $ticket->reporters()->count();
        $reporterScore = min($reporterCount / 10, 1.0) * 100;
        $factors['reporters'] = $reporterCount;
        $factors['reporters_score'] = $reporterScore;
        $totalScore += $reporterScore * ($weights['reporters'] ?? 20) / 100;

        // Faktor 3: Kelas jalan
        $roadScore = $this->getRoadClassScore($ticket);
        $factors['road_class'] = $roadScore;
        $totalScore += $roadScore * ($weights['road_class'] ?? 20) / 100;

        // Faktor 4: Kedekatan fasilitas kritis
        $proximityScore = $this->getProximityScore($ticket);
        $factors['proximity'] = $proximityScore;
        $totalScore += $proximityScore * ($weights['proximity'] ?? 15) / 100;

        // Faktor 5: Umur tiket
        $ageDays = $ticket->created_at->diffInDays(now());
        $ageScore = min($ageDays / 30, 1.0) * 100;
        $factors['age_days'] = $ageDays;
        $factors['age_score'] = $ageScore;
        $totalScore += $ageScore * ($weights['age'] ?? 15) / 100;

        $totalScore = round($totalScore, 4);

        $ticket->update([
            'priority_score' => $totalScore,
            'priority_label' => $this->determineLabel($totalScore),
        ]);

        $ticket->prioritySnapshots()->create([
            'total_score' => $totalScore,
            'factors' => $factors,
            'configuration_version' => $config->version,
        ]);

        return $totalScore;
    }

    /**
     * Recompute semua tiket aktif (untuk faktor umur).
     */
    public function recomputeAllActiveTickets(): int
    {
        $tickets = \App\Models\Ticket::query()
            ->whereIn('status', ['reported', 'validated', 'in_queue', 'in_progress'])
            ->get();

        $count = 0;
        foreach ($tickets as $ticket) {
            $this->calculatePriorityScore($ticket);
            $count++;
        }

        return $count;
    }

    private function getActiveConfiguration(): PriorityConfiguration
    {
        return PriorityConfiguration::active()->first()
            ?? $this->createDefaultConfiguration();
    }

    private function createDefaultConfiguration(): PriorityConfiguration
    {
        return PriorityConfiguration::create([
            'version' => 1,
            'weights' => [
                'severity' => 30,
                'reporters' => 20,
                'road_class' => 20,
                'proximity' => 15,
                'age' => 15,
            ],
            'clustering_radius_meters' => 20,
            'ai_accepted_threshold' => 0.7,
            'ai_rejected_threshold' => 0.3,
            'is_active' => true,
        ]);
    }

    private function getSeverityScore(Ticket $ticket): float
    {
        $latestValidation = $ticket->reports()
            ->with('aiValidations')
            ->get()
            ->flatMap(fn ($r) => $r->aiValidations)
            ->sortByDesc('created_at')
            ->first();

        if (! $latestValidation || ! $latestValidation->result) {
            return 50.0;
        }

        return match ($latestValidation->result['severity'] ?? 'moderate') {
            'critical' => 100.0,
            'high' => 80.0,
            'moderate' => 50.0,
            'low' => 20.0,
            default => 50.0,
        };
    }

    private function getRoadClassScore(Ticket $ticket): float
    {
        if (! $ticket->location) {
            return 50.0;
        }

        $roadSegment = DB::table('road_segments')
            ->whereNotNull('geometry')
            ->whereRaw(
                'ST_DWithin(geometry::geography, location::geography, 100)',
            )
            ->whereRaw(
                'ST_DWithin(geometry::geography, ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography, 100)',
                [DB::raw('ST_X(' . $ticket->getQualifiedColumn('location') . ')'), DB::raw('ST_Y(' . $ticket->getQualifiedColumn('location') . ')')]
            )
            ->first();

        if (! $roadSegment) {
            return 50.0;
        }

        return match ($roadSegment->road_class) {
            'arterial' => 100.0,
            'collector' => 70.0,
            'local' => 40.0,
            default => 50.0,
        };
    }

    private function getProximityScore(Ticket $ticket): float
    {
        if (! $ticket->location) {
            return 0.0;
        }

        $nearestFacility = DB::table('critical_facilities')
            ->whereNotNull('location')
            ->whereRaw(
                'ST_DWithin(location::geography, ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography, 500)',
                [DB::raw('ST_X(' . $ticket->getQualifiedColumn('location') . ')'), DB::raw('ST_Y(' . $ticket->getQualifiedColumn('location') . ')')]
            )
            ->orderByRaw(
                'ST_Distance(location::geography, ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography)',
                [DB::raw('ST_X(' . $ticket->getQualifiedColumn('location') . ')'), DB::raw('ST_Y(' . $ticket->getQualifiedColumn('location') . ')')]
            )
            ->first();

        if (! $nearestFacility) {
            return 0.0;
        }

        $distance = DB::selectOne(
            'SELECT ST_Distance(location::geography, ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography) as dist',
            [DB::raw('ST_X(' . $ticket->getQualifiedColumn('location') . ')'), DB::raw('ST_Y(' . $ticket->getQualifiedColumn('location') . ')')]
        );

        $distanceMeters = $distance->dist ?? 500;

        return max(0, (1 - $distanceMeters / 500)) * 100;
    }

    private function determineLabel(float $score): string
    {
        if ($score >= 70) return 'urgent';
        if ($score >= 30) return 'waiting';
        return 'completed';
    }
}
