<?php

namespace App\Jobs;

use App\Enums\ReportStatus;
use App\Enums\TicketStatus;
use App\Models\AiValidation;
use App\Models\Report;
use App\Models\Ticket;
use App\Services\Contracts\AiImageValidator;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

final class ValidateReportImage implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries;
    public int $timeout;
    public int $maxExceptions = 1;

    public function __construct(public readonly int $reportId)
    {
        $this->tries = config('nadi-kota.queue.validate_image_tries', 3);
        $this->timeout = config('nadi-kota.queue.validate_image_timeout', 30);
    }

    public function handle(AiImageValidator $validator): void
    {
        $report = Report::with(['photos', 'ticket'])->findOrFail($this->reportId);
        $photo = $report->photos->firstWhere('type', 'before');

        if (! $photo) {
            Log::warning('ValidateReportImage: no before photo found', ['report_id' => $this->reportId]);
            $this->markNeedsReview($report, 'Foto tidak ditemukan.');
            return;
        }

        try {
            $validationResult = $validator->validate($photo);

            $report->aiValidations()->create([
                'result' => $validationResult['result'],
                'decision' => $validationResult['decision'],
                'confidence' => $validationResult['confidence'],
                'model' => $validationResult['model'],
                'prompt_version' => $validationResult['prompt_version'],
            ]);

            $report->update(['status' => match ($validationResult['decision']) {
                'accepted' => ReportStatus::VALIDATED,
                'rejected' => ReportStatus::REJECTED,
                default => ReportStatus::NEEDS_REVIEW,
            }]);

            // Update ticket status jika diperlukan
            if ($report->ticket && $validationResult['decision'] === 'accepted') {
                $ticket = $report->ticket;
                if ($ticket->status === TicketStatus::REPORTED) {
                    $ticket->update(['status' => TicketStatus::VALIDATED, 'verified_at' => now()]);
                    $ticket->statusHistories()->create([
                        'from_status' => TicketStatus::REPORTED->value,
                        'to_status' => TicketStatus::VALIDATED->value,
                        'note' => 'Divalidasi AI',
                    ]);
                }
            }

            // Siapkan umpan balik untuk warga jika ditolak
            if ($validationResult['decision'] === 'rejected') {
                $this->prepareRejectionFeedback($report, $validationResult);
            }

        } catch (\Throwable $e) {
            Log::error('ValidateReportImage failed', [
                'report_id' => $this->reportId,
                'error' => $e->getMessage(),
            ]);

            $report->aiValidations()->create([
                'decision' => 'suspicious',
                'error' => $e->getMessage(),
                'model' => config('nadi-kota.ai.model', 'gpt-4o-mini'),
                'prompt_version' => config('nadi-kota.ai.prompt_version', 'v1.0'),
            ]);

            $this->markNeedsReview($report, 'Validasi AI gagal: ' . $e->getMessage());
        }
    }

    private function markNeedsReview(Report $report, string $note): void
    {
        $report->update(['status' => ReportStatus::NEEDS_REVIEW]);

        if ($report->ticket && $report->ticket->status === TicketStatus::REPORTED) {
            $report->ticket->update(['status' => TicketStatus::NEEDS_REVIEW]);
            $report->ticket->statusHistories()->create([
                'from_status' => TicketStatus::REPORTED->value,
                'to_status' => TicketStatus::NEEDS_REVIEW->value,
                'note' => $note,
            ]);
        }
    }

    private function prepareRejectionFeedback(Report $report, array $result): void
    {
        $reason = $result['result']['reason'] ?? 'Foto tidak memenuhi kriteria validasi.';
        $suggestion = match ($result['result']['feasibility'] ?? 'invalid') {
            'invalid' => 'Unggah foto baru yang jelas menunjukkan kerusakan.',
            'uncertain' => 'Foto kurang jelas. Coba ambil dari jarak yang lebih dekat.',
            default => 'Periksa kembali foto Anda.',
        };

        // Simpan data siap pakai untuk notifikasi (Fase 9)
        $report->update([
            'rejection_reason' => $reason,
            'rejection_suggestion' => $suggestion,
        ]);

        Log::info('Rejection feedback prepared', [
            'report_id' => $report->id,
            'reason' => $reason,
            'suggestion' => $suggestion,
        ]);
    }

    public function backoff(): array
    {
        return [10, 30, 60];
    }

    public function failed(\Throwable $exception): void
    {
        Log::error('ValidateReportImage permanently failed', [
            'report_id' => $this->reportId,
            'error' => $exception->getMessage(),
        ]);
    }
}
