<?php

namespace App\Services;

use App\Enums\ReportStatus;
use App\Jobs\ValidateReportImage;
use App\Models\Report;
use App\Models\User;
use App\Repositories\Contracts\ReportRepository;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;

class ReportService
{
    public function __construct(
        private readonly ReportRepository $reports,
        private readonly ClusteringService $clustering,
    ) {}

    /**
     * Buat laporan baru dengan foto, clustering, dan dispatch AI validation.
     */
    public function create(
        User $user,
        array $payload,
        UploadedFile $photo,
        ?string $idempotencyKey = null,
        ?string $ip = null,
    ): Report {
        $idempotencyKey = $idempotencyKey ?? uniqid('report-', true);

        // Cek duplikat idempotency
        $existing = Report::where('user_id', $user->id)
            ->where('idempotency_key', $idempotencyKey)
            ->first();
        if ($existing) {
            return $existing;
        }

        // Filter dasar: frekuensi per user per hari
        $dailyKey = 'report_count:' . $user->id . ':' . now()->format('Y-m-d');
        $dailyCount = (int) Redis::incr($dailyKey);
        if ($dailyCount === 1) {
            Redis::expire($dailyKey, 86400);
        }
        $maxDaily = config('nadi-kota.rate_limiting.reports_per_user_per_day', 10);

        // Simpan foto ke disk (lokal public / S3 jika dikonfigurasi)
        $objectKey = 'photos/' . now()->format('Y/m/d') . '/' . uniqid() . '.' . $photo->getClientOriginalExtension();
        $photo->storeAs('photos/' . now()->format('Y/m/d'), basename($objectKey));

        return DB::transaction(function () use ($user, $payload, $photo, $idempotencyKey, $objectKey, $dailyCount, $maxDaily, $ip) {
            // Cari tiket terdekat
            $nearbyTicketId = $this->reports->findNearbyActiveTicket(
                $payload['category'],
                (float) $payload['latitude'],
                (float) $payload['longitude'],
                config('nadi-kota.clustering.radius_meters', 20),
            );

            $status = ReportStatus::SUBMITTED;
            if ($dailyCount > $maxDaily) {
                $status = ReportStatus::NEEDS_REVIEW;
            }

            $report = $this->reports->create($user, [
                'category' => $payload['category'],
                'status' => $status,
                'latitude' => $payload['latitude'],
                'longitude' => $payload['longitude'],
                'idempotency_key' => $idempotencyKey,
                'ticket_id' => $nearbyTicketId,
                'server_captured_at' => now(),
            ]);

            $report->photos()->create([
                'type' => 'before',
                'object_key' => $objectKey,
                'sha256' => hash_file('sha256', $photo->getRealPath()),
                'mime_type' => $photo->getMimeType(),
                'size_bytes' => $photo->getSize(),
            ]);

            if ($nearbyTicketId !== null) {
                $this->clustering->addUniqueReporter($nearbyTicketId, $user->id);
            } else {
                $ticket = $this->clustering->createTicketFromReport($report);
                $report->update(['ticket_id' => $ticket->id]);
            }

            // Dispatch AI validation hanya untuk laporan yang lolos filter
            if ($status === ReportStatus::SUBMITTED) {
                ValidateReportImage::dispatch($report->id, $ip)
                    ->onQueue('ai-validation')
                    ->afterCommit();
            }

            return $report;
        });
    }
}
