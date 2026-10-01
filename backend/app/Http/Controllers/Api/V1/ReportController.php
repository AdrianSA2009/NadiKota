<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\ReportCategory;
use App\Enums\ReportStatus;
use App\Enums\TicketStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreReportRequest;
use App\Http\Resources\BaseResource;
use App\Models\Report;
use App\Services\ReportService;
use App\Support\PhotoUrl;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class ReportResource extends BaseResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'ticketId' => $this->ticket_id,
            'category' => $this->category instanceof ReportCategory
                ? $this->category->value : $this->category,
            'status' => $this->status instanceof ReportStatus
                ? $this->status->value : $this->status,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'serverCapturedAt' => $this->server_captured_at,
            'createdAt' => $this->created_at,
            'photos' => $this->whenLoaded('photos', function () {
                return $this->photos->map(fn ($p) => [
                    'id' => $p->id,
                    'type' => $p->type,
                    'objectKey' => $p->object_key,
                    'photoUrl' => PhotoUrl::make($p->object_key),
                ]);
            }),
            'ticket' => $this->whenLoaded('ticket', fn () => [
                'id' => $this->ticket->id,
                'ticketNumber' => $this->ticket->ticket_number,
                'status' => $this->ticket->status instanceof TicketStatus
                    ? $this->ticket->status->value : $this->ticket->status,
            ]),
        ];
    }
}

final class ReportController extends Controller
{
    public function store(StoreReportRequest $request, ReportService $reportService): JsonResponse
    {
        $idempotencyKey = $request->header('Idempotency-Key');

        $report = $reportService->create(
            $request->user(),
            $request->validated(),
            $request->file('photo'),
            $idempotencyKey,
            $request->ip(),
        );

        return (new ReportResource($report->load('ticket')))
            ->response()
            ->setStatusCode(202);
    }

    public function show(Request $request, Report $report): JsonResource
    {
        Gate::authorize('view', $report);

        $report->load(['photos', 'ticket']);

        return new ReportResource($report);
    }
}
