<?php

namespace App\Jobs;

use App\Enums\ReportStatus;
use App\Enums\TicketStatus;
use App\Models\Report;
use App\Models\Ticket;
use App\Services\Contracts\AiImageValidator;
use App\Services\LocationSpoofDetector;
use App\Services\PointService;
use App\Services\RecapturedPhotoDetector;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

final class ValidateReportImage implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries;

    public int $timeout;

    public int $maxExceptions = 1;

    public function __construct(public readonly int $reportId, public readonly ?string $ip = null)
    {
        $this->tries = config('nadi-kota.queue.validate_image_tries', 3);
        $this->timeout = config('nadi-kota.queue.validate_image_timeout', 30);
    }

    public function handle(
        AiImageValidator $validator,
        RecapturedPhotoDetector $detector,
        PointService $points,
        LocationSpoofDetector $spoof,
    ): void {
        $report = Report::with(['photos', 'ticket', 'user'])->findOrFail($this->reportId);
        $photo = $report->photos->firstWhere('type', 'before');

        if (! $photo) {
            Log::warning('ValidateReportImage: no before photo found', ['report_id' => $this->reportId]);
            $this->markNeedsReview($report, 'Foto tidak ditemukan.');

            return;
        }

        try {
            $contents = Storage::disk(config('filesystems.default'))->get($photo->object_key);
            $captureCheck = is_string($contents)
                ? $detector->inspect($contents, $photo->mime_type)
                : ['is_rephoto' => false, 'score' => 0.0, 'has_camera_exif' => false, 'signals' => []];

            if ($captureCheck['is_rephoto'] && $detector->hasHardEvidence($captureCheck)) {
                $report->aiValidations()->create([
                    'result' => [
                        'source' => 'rephoto',
                        'detection' => 'deterministic',
                        'signals' => $captureCheck['signals'],
                        'score' => $captureCheck['score'],
                        'has_camera_exif' => $captureCheck['has_camera_exif'],
                    ],
                    'decision' => 'rejected',
                    'confidence' => 1,
                    'model' => 'deterministic-rephoto-detector',
                    'prompt_version' => 'v1.0',
                ]);
                $report->update([
                    'status' => ReportStatus::REJECTED,
                    'rejection_reason' => 'Foto terdeteksi diambil dari layar atau gambar lain, bukan kamera langsung.',
                    'rejection_suggestion' => 'Ambil foto langsung dengan kamera di lokasi kerusakan.',
                ]);

                return;
            }

            // Sinyal lokasi mencurigakan (fake GPS): EXIF GPS foto vs koordinat klaim + IP geo
            $anomalyReasons = $spoof->inspect(
                is_string($contents) ? $contents : null,
                $photo->mime_type,
                (float) $report->latitude,
                (float) $report->longitude,
                $this->ip,
            );

            $validationResult = $validator->validate($photo, $captureCheck['signals']);

            if ($anomalyReasons !== []) {
                $validationResult['result']['location_anomaly'] = $anomalyReasons;
            }

            // AI bilang fotonya dari layar/screenshot → tolak (di luar deteksi piksel yang lemah),
            // kecuali isi foto sendiri dinilai tidak valid — itu kasus "tidak sesuai kriteria".
            $aiSourceRephoto = ($validationResult['result']['source'] ?? 'direct') !== 'direct'
                && ($validationResult['result']['feasibility'] ?? 'uncertain') !== 'invalid';
            $decision = $aiSourceRephoto ? 'rejected' : $validationResult['decision'];

            $report->aiValidations()->create([
                'result' => $validationResult['result'],
                'decision' => $decision,
                'confidence' => $validationResult['confidence'],
                'model' => $validationResult['model'],
                'prompt_version' => $validationResult['prompt_version'],
            ]);

            // Lokasi tidak konsisten → tahan laporan untuk review, jangan beri poin
            $flagged = $decision === 'accepted' && $anomalyReasons !== [];

            $report->update(['status' => match (true) {
                $flagged => ReportStatus::NEEDS_REVIEW,
                $decision === 'accepted' => ReportStatus::VALIDATED,
                $decision === 'rejected' => ReportStatus::REJECTED,
                default => ReportStatus::NEEDS_REVIEW,
            }]);

            if ($flagged) {
                $this->markNeedsReview($report, 'Lokasi mencurigakan: ' . implode(', ', $anomalyReasons));
            }

            // Tiket baru ikut berstatus: hanya accepted (tunggu tinjauan admin) atau needs_review.
            // Menolak laporan berarti menutup tiket — bukan antrean review.
            if ($report->ticket) {
                $target = match (true) {
                    $decision === 'accepted' && ! $flagged => TicketStatus::NEEDS_REVIEW,
                    in_array($decision, ['suspicious', 'rejected'], true) => TicketStatus::NEEDS_REVIEW,
                    default => null,
                };
                $note = match (true) {
                    $flagged => 'Lokasi mencurigakan: ' . implode(', ', $anomalyReasons),
                    $decision === 'accepted' => 'Divalidasi AI — menunggu tinjauan admin',
                    $decision === 'rejected' => 'Laporan ditolak AI — menunggu tinjauan admin',
                    default => 'AI tidak yakin — menunggu tinjauan admin',
                };

                $moved = $this->syncTicketStatus($report, $target, $note);

                // Kabar ke admin: tiket kini resmi menunggu penilaian.
                if ($moved && $target === TicketStatus::NEEDS_REVIEW) {
                    SendRoleNotification::dispatch(['admin', 'super_admin'], [
                        'type' => 'ticket_assessment',
                        'title' => 'Tiket membutuh penilaian',
                        'body' => "Tiket {$report->ticket->ticket_number} menunggu tinjauan admin — periksa dan putuskan.",
                        'data' => ['ticket_id' => $report->ticket->id, 'ticket_number' => $report->ticket->ticket_number],
                    ])->onQueue('notifications');
                }
            }

            // Siapkan umpan balik untuk warga jika ditolak
            if ($decision === 'rejected') {
                $this->prepareRejectionFeedback($report, $validationResult);
            }

            // Beri poin kontribusi saat laporan diterima
            if ($decision === 'accepted' && ! $flagged) {
                $earned = (int) config('nadi-kota.points.report_accepted', 10);
                $points->earn($report->user, $earned, 'Laporan diterima: ' . ($report->ticket->ticket_number ?? ''));
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

    /**
     * Selaraskan status tiket dengan hasil AI (hanya dari REPORTED → NEEDS_REVIEW) + catat history.
     * Return true bila status benar-benar berubah.
     */
    private function syncTicketStatus(Report $report, ?TicketStatus $target, string $note): bool
    {
        if ($target === null || $report->ticket === null || $report->ticket->status !== TicketStatus::REPORTED) {
            return false;
        }

        $report->ticket->update(['status' => $target]);
        $report->ticket->statusHistories()->create([
            'from_status' => TicketStatus::REPORTED->value,
            'to_status' => $target->value,
            'note' => $note,
        ]);

        return true;
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

            // Kabar ke admin: tiket ini harus ditinjau secara manual.
            SendRoleNotification::dispatch(['admin', 'super_admin'], [
                'type' => 'ticket_assessment',
                'title' => 'Tiket membutuh penilaian',
                'body' => "Tiket {$report->ticket->ticket_number} perlu ditinjau manual oleh admin.",
                'data' => ['ticket_id' => $report->ticket->id, 'ticket_number' => $report->ticket->ticket_number],
            ])->onQueue('notifications');
        }
    }

    private function prepareRejectionFeedback(Report $report, array $result): void
    {
        $sourceRephoto = ($result['result']['source'] ?? 'direct') !== 'direct'
            && ($result['result']['feasibility'] ?? 'uncertain') !== 'invalid';
        $reason = $sourceRephoto
            ? 'Foto terdeteksi diambil dari layar atau gambar lain, bukan kamera langsung.'
            : ($result['result']['reason'] ?? 'Foto tidak memenuhi kriteria validasi.');
        $suggestion = $sourceRephoto
            ? 'Ambil foto langsung dengan kamera di lokasi kerusakan.'
            : match ($result['result']['feasibility'] ?? 'invalid') {
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
