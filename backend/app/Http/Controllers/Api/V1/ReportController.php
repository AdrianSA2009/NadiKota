<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreReportRequest;
use App\Services\ReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class ReportResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'ticket_id' => $this->ticket_id,
            'category' => $this->category instanceof \App\Enums\ReportCategory
                ? $this->category->value : $this->category,
            'status' => $this->status instanceof \App\Enums\ReportStatus
                ? $this->status->value : $this->status,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'server_captured_at' => $this->server_captured_at,
            'created_at' => $this->created_at,
            'photos' => $this->whenLoaded('photos', function () {
                return $this->photos->map(fn ($p) => [
                    'id' => $p->id,
                    'type' => $p->type,
                    'object_key' => $p->object_key,
                ]);
            }),
            'ticket' => $this->whenLoaded('ticket', fn () => [
                'id' => $this->ticket->id,
                'ticket_number' => $this->ticket->ticket_number,
                'status' => $this->ticket->status instanceof \App\Enums\TicketStatus
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
        );

        return (new ReportResource($report->load('ticket')))
            ->response()
            ->setStatusCode(201);
    }

    public function show(Request $request, \App\Models\Report $report): JsonResource
    {
        Gate::authorize('view', $report);

        $report->load(['photos', 'ticket']);

        return new ReportResource($report);
    }
}
