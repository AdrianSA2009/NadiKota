<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\ReportStatus;
use App\Jobs\ScreenReportPhoto;
use App\Jobs\ValidateReportImage;
use App\Models\Photo;
use App\Models\Report;
use App\Models\Ticket;
use App\Models\User;
use App\Services\Contracts\AiImageValidator;
use App\Services\RecapturedPhotoDetector;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Mockery\MockInterface;
use Tests\TestCase;

final class RecapturedPhotoDetectorTest extends TestCase
{
    use RefreshDatabase;

    public function test_detects_dark_phone_or_screen_edge_before_ai(): void
    {
        $image = imagecreatetruecolor(180, 180);
        $phoneEdge = imagecolorallocate($image, 20, 20, 20);
        imagefilledrectangle($image, 0, 0, 179, 179, $phoneEdge);
        imagefilledrectangle($image, 14, 14, 165, 165, imagecolorallocate($image, 220, 220, 215));
        imagejpeg($image, $path = tempnam(sys_get_temp_dir(), 'rephoto-') . '.jpg');
        imagedestroy($image);

        $result = app(RecapturedPhotoDetector::class)->inspect(file_get_contents($path), 'image/jpeg');
        unlink($path);

        expect($result['is_rephoto'])->toBeTrue()
            ->and($result['signals'])->toContain('dark_screen_or_phone_edge');
    }

    public function test_detects_periodic_screen_pattern_before_ai(): void
    {
        $image = imagecreatetruecolor(180, 180);
        $white = imagecolorallocate($image, 245, 245, 245);
        $stripe = imagecolorallocate($image, 185, 185, 185);
        imagefill($image, 0, 0, $white);
        for ($x = 0; $x < 180; $x += 6) {
            imagefilledrectangle($image, $x, 0, $x + 3, 179, $stripe);
        }
        imagejpeg($image, $path = tempnam(sys_get_temp_dir(), 'rephoto-') . '.jpg');
        imagedestroy($image);

        $result = app(RecapturedPhotoDetector::class)->inspect(file_get_contents($path), 'image/jpeg');
        unlink($path);

        expect($result['is_rephoto'])->toBeTrue()
            ->and($result['signals'])->toContain('periodic_moire_pattern');
    }

    public function test_does_not_flag_natural_camera_image_without_metadata(): void
    {
        mt_srand(42);
        $image = imagecreatetruecolor(180, 180);
        for ($y = 0; $y < 180; $y++) {
            for ($x = 0; $x < 180; $x++) {
                $shade = 60 + (($x * 37 + $y * 53 + mt_rand(0, 45)) % 150);
                imagesetpixel($image, $x, $y, imagecolorallocate($image, $shade, $shade, $shade - 5));
            }
        }
        imagejpeg($image, $path = tempnam(sys_get_temp_dir(), 'natural-') . '.jpg');
        imagedestroy($image);

        $result = app(RecapturedPhotoDetector::class)->inspect(file_get_contents($path), 'image/jpeg');
        unlink($path);

        expect($result['is_rephoto'])->toBeFalse();
    }

    public function test_screening_rejects_rephoto_with_hard_evidence_without_calling_ai(): void
    {
        Storage::disk('local')->put('photos/screening/test.jpg', 'dummy-jpeg-bytes');
        $checkId = '22222222-2222-4222-8222-222222222222';

        $this->mock(RecapturedPhotoDetector::class, function (MockInterface $mock): void {
            $mock->shouldReceive('inspect')->once()->andReturn([
                'is_rephoto' => true,
                'score' => 0.95,
                'has_camera_exif' => false,
                'signals' => ['metadata_screenshot'],
            ]);
            $mock->shouldReceive('hasHardEvidence')->once()->andReturnTrue();
        });
        $this->mock(AiImageValidator::class, function (MockInterface $mock): void {
            $mock->shouldNotReceive('validate');
        });

        ScreenReportPhoto::dispatchSync($checkId, 'photos/screening/test.jpg', 'image/jpeg');

        $this->assertSame('rephoto', cache(ScreenReportPhoto::cacheKey($checkId))['detection']);
        expect(cache(ScreenReportPhoto::cacheKey($checkId))['ok'])->toBeFalse();
    }

    public function test_screening_labels_direct_but_invalid_photo_as_criteria_failure(): void
    {
        Storage::disk('local')->put('photos/screening/test.jpg', 'dummy-jpeg-bytes');
        $checkId = '33333333-2222-4222-8222-222222222222';

        // Deteksi piksel mencurigakan tapi bukti lemah → AI tetap dipanggil.
        $this->mock(RecapturedPhotoDetector::class, function (MockInterface $mock): void {
            $mock->shouldReceive('inspect')->once()->andReturn([
                'is_rephoto' => true,
                'score' => 0.9,
                'has_camera_exif' => false,
                'signals' => ['dark_screen_or_phone_edge'],
            ]);
            $mock->shouldReceive('hasHardEvidence')->once()->andReturnFalse();
        });
        $this->mock(AiImageValidator::class, function (MockInterface $mock): void {
            $mock->shouldReceive('validate')->once()->andReturn([
                'result' => ['source' => 'direct', 'feasibility' => 'invalid', 'reason' => 'Objek kerusakan tidak terlihat.'],
                'decision' => 'rejected',
                'confidence' => 0.9,
                'model' => 'test-model',
                'prompt_version' => 'v1.0',
            ]);
        });

        ScreenReportPhoto::dispatchSync($checkId, 'photos/screening/test.jpg', 'image/jpeg');

        $cached = cache(ScreenReportPhoto::cacheKey($checkId));
        $this->assertSame('direct', $cached['detection']);
        $this->assertSame('Objek kerusakan tidak terlihat.', $cached['reason']);
        expect($cached['ok'])->toBeFalse();
    }

    public function test_screening_keeps_rephoto_when_ai_confirms_source(): void
    {
        Storage::disk('local')->put('photos/screening/test.jpg', 'dummy-jpeg-bytes');
        $checkId = '44444444-2222-4222-8222-222222222222';

        $this->mock(RecapturedPhotoDetector::class, function (MockInterface $mock): void {
            $mock->shouldReceive('inspect')->once()->andReturn([
                'is_rephoto' => true,
                'score' => 0.9,
                'has_camera_exif' => false,
                'signals' => ['dark_screen_or_phone_edge'],
            ]);
            $mock->shouldReceive('hasHardEvidence')->once()->andReturnFalse();
        });
        $this->mock(AiImageValidator::class, function (MockInterface $mock): void {
            $mock->shouldReceive('validate')->once()->andReturn([
                'result' => ['source' => 'rephoto', 'feasibility' => 'uncertain', 'reason' => 'Ada indikasi layar.'],
                'decision' => 'suspicious',
                'confidence' => 0.8,
                'model' => 'test-model',
                'prompt_version' => 'v1.0',
            ]);
        });

        ScreenReportPhoto::dispatchSync($checkId, 'photos/screening/test.jpg', 'image/jpeg');

        $cached = cache(ScreenReportPhoto::cacheKey($checkId));
        $this->assertSame('ai_rephoto', $cached['detection']);
        expect($cached['ok'])->toBeFalse();
    }

    public function test_post_submission_validation_rejects_rephoto_without_calling_ai(): void
    {
        $objectKey = 'photos/test/rephoto.jpg';
        Storage::disk('local')->put($objectKey, 'dummy-jpeg-bytes');

        $user = User::factory()->citizen()->create();
        $ticket = Ticket::factory()->create(['status' => 'reported']);
        $report = Report::factory()->create([
            'user_id' => $user->id,
            'ticket_id' => $ticket->id,
            'status' => ReportStatus::SUBMITTED,
        ]);
        Photo::factory()->create([
            'report_id' => $report->id,
            'object_key' => $objectKey,
            'mime_type' => 'image/jpeg',
            'type' => 'before',
        ]);

        $this->mock(RecapturedPhotoDetector::class, function (MockInterface $mock): void {
            $mock->shouldReceive('inspect')->once()->andReturn([
                'is_rephoto' => true,
                'score' => 0.95,
                'has_camera_exif' => false,
                'signals' => ['metadata_screenshot'],
            ]);
            $mock->shouldReceive('hasHardEvidence')->once()->andReturnTrue();
        });
        $this->mock(AiImageValidator::class, function (MockInterface $mock): void {
            $mock->shouldNotReceive('validate');
        });

        ValidateReportImage::dispatchSync($report->id);

        expect($report->fresh()->status)->toBe(ReportStatus::REJECTED);
        $this->assertDatabaseHas('ai_validations', [
            'report_id' => $report->id,
            'decision' => 'rejected',
            'model' => 'deterministic-rephoto-detector',
        ]);
    }
}
