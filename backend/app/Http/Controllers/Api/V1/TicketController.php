<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\TicketStatus;
use App\Http\Controllers\Controller;
use App\Jobs\SendTicketNotification;
use App\Models\AuditLog;
use App\Models\Dispatch;
use App\Models\Ticket;
use App\Models\TicketStatusHistory;
use App\Services\ClusteringService;
use App\Services\PriorityService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class TicketController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', Ticket::class);

        $query = Ticket::orderByDesc('priority_score');

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }
        if ($request->filled('category')) {
            $query->where('category', $request->input('category'));
        }
        if ($request->filled('district')) {
            $query->where('district', $request->input('district'));
        }
        if ($request->filled('from') && $request->filled('to')) {
            $query->whereBetween('created_at', [$request->input('from'), $request->input('to')]);
        }

        $tickets = $query->paginate($request->integer('per_page', 20));

        return response()->json($tickets);
    }

    public function show(Ticket $ticket): JsonResponse
    {
        Gate::authorize('view', $ticket);

        $ticket->load([
            'reports' => fn ($q) => $q->select('id', 'ticket_id', 'user_id', 'category', 'status', 'created_at'),
            'photos',
            'prioritySnapshots',
            'statusHistories',
            'dispatches',
        ]);

        $reporterCount = $ticket->reporters()->count();

        return response()->json([
            'data' => [
                'id' => $ticket->id,
                'ticket_number' => $ticket->ticket_number,
                'category' => $ticket->category,
                'status' => $ticket->status,
                'priority_score' => $ticket->priority_score,
                'priority_label' => $ticket->priority_label,
                'reporter_count' => $reporterCount,
                'latitude' => null,
                'longitude' => null,
                'reports' => $ticket->reports,
                'photos' => $ticket->photos,
                'priority_snapshots' => $ticket->prioritySnapshots,
                'status_histories' => $ticket->statusHistories,
                'dispatches' => $ticket->dispatches,
                'created_at' => $ticket->created_at,
            ],
        ]);
    }

    /**
     * POST /tickets/{ticket}/support — idempotent, tidak buat tiket baru.
     */
    public function support(
        Ticket $ticket,
        Request $request,
        ClusteringService $clusteringService,
        PriorityService $priorityService,
    ): JsonResponse {
        Gate::authorize('support', $ticket);

        $user = $request->user();

        if ($ticket->status === TicketStatus::COMPLETED || $ticket->status === TicketStatus::REJECTED) {
            return response()->json([
                'error' => ['message' => 'Tiket sudah tidak aktif.'],
            ], 422);
        }

        $alreadyReported = $ticket->reporters()->where('user_id', $user->id)->exists();

        $clusteringService->addUniqueReporter($ticket->id, $user->id);

        $priorityService->calculatePriorityScore($ticket->fresh());

        $reporterCount = $ticket->fresh()->reporters()->count();

        return response()->json([
            'data' => [
                'ticket_id' => $ticket->id,
                'reporter_count' => $reporterCount,
                'priority_score' => $ticket->fresh()->priority_score,
                'message' => $alreadyReported
                    ? 'Anda sudah mendukung tiket ini.'
                    : 'Dukungan Anda tercatat.',
            ],
        ]);
    }

    /**
     * POST /tickets/{ticket}/review — menyetujui/menolak tiket suspicious.
     */
    public function review(Request $request, Ticket $ticket): JsonResponse
    {
        Gate::authorize('review', $ticket);

        if ($ticket->status !== TicketStatus::NEEDS_REVIEW) {
            return response()->json([
                'error' => ['message' => 'Hanya tiket berstatus Perlu Tinjauan yang bisa direview.'],
            ], 409);
        }

        $validated = $request->validate([
            'decision' => 'required|in:approved,rejected',
            'reason' => 'required|string|min:3|max:500',
        ]);

        return DB::transaction(function () use ($ticket, $validated, $request) {
            $before = [
                'status' => $ticket->status->value,
                'review_status' => $ticket->review_status,
            ];

            $newStatus = $validated['decision'] === 'approved'
                ? TicketStatus::VALIDATED
                : TicketStatus::REJECTED;

            $ticket->update([
                'status' => $newStatus,
                'review_status' => $validated['decision'],
                'verified_at' => $validated['decision'] === 'approved' ? now() : null,
            ]);

            $ticket->statusHistories()->create([
                'from_status' => TicketStatus::NEEDS_REVIEW->value,
                'to_status' => $newStatus->value,
                'actor_id' => $request->user()->id,
                'note' => $validated['reason'],
            ]);

            AuditLog::create([
                'actor_id' => $request->user()->id,
                'action' => 'review_ticket',
                'entity_type' => Ticket::class,
                'entity_id' => $ticket->id,
                'before' => $before,
                'after' => [
                    'status' => $newStatus->value,
                    'decision' => $validated['decision'],
                    'reason' => $validated['reason'],
                ],
                'request_id' => $request->header('X-Request-Id'),
            ]);

            return response()->json([
                'data' => [
                    'ticket_id' => $ticket->id,
                    'status' => $newStatus->value,
                    'decision' => $validated['decision'],
                    'message' => $validated['decision'] === 'approved'
                        ? 'Tiket disetujui dan masuk antrean.'
                        : 'Tiket ditolak.',
                ],
            ]);
        });
    }

    /**
     * POST /tickets/{ticket}/dispatch — menugaskan tim lapangan.
     */
    public function dispatch(Request $request, Ticket $ticket): JsonResponse
    {
        Gate::authorize('dispatch', $ticket);

        $validated = $request->validate([
            'team_id' => 'required|exists:teams,id',
            'note' => 'nullable|string|max:500',
        ]);

        $team = \App\Models\Team::findOrFail($validated['team_id']);

        if (! $team->is_active) {
            return response()->json([
                'error' => ['message' => 'Tim tidak aktif.'],
            ], 422);
        }

        return DB::transaction(function () use ($ticket, $validated, $request, $team) {
            $before = [
                'status' => $ticket->status->value,
                'assigned_team_id' => $ticket->assigned_team_id,
            ];

            $ticket->update([
                'status' => TicketStatus::IN_PROGRESS,
                'assigned_team_id' => $team->id,
                'started_at' => now(),
            ]);

            $ticket->statusHistories()->create([
                'from_status' => $before['status'],
                'to_status' => TicketStatus::IN_PROGRESS->value,
                'actor_id' => $request->user()->id,
                'note' => 'Dispatch ke ' . $team->name,
            ]);

            Dispatch::create([
                'ticket_id' => $ticket->id,
                'team_id' => $team->id,
                'actor_id' => $request->user()->id,
                'note' => $validated['note'] ?? null,
            ]);

            AuditLog::create([
                'actor_id' => $request->user()->id,
                'action' => 'dispatch_ticket',
                'entity_type' => Ticket::class,
                'entity_id' => $ticket->id,
                'before' => $before,
                'after' => [
                    'status' => TicketStatus::IN_PROGRESS->value,
                    'assigned_team_id' => $team->id,
                    'team_name' => $team->name,
                ],
                'request_id' => $request->header('X-Request-Id'),
            ]);

            // Dispatch notifikasi ke warga dan tim
            SendTicketNotification::dispatch($ticket->id, 'in_progress', 'Tim ' . $team->name . ' ditugaskan.')
                ->onQueue('notifications');

            return response()->json([
                'data' => [
                    'ticket_id' => $ticket->id,
                    'status' => TicketStatus::IN_PROGRESS->value,
                    'team' => [
                        'id' => $team->id,
                        'name' => $team->name,
                    ],
                    'message' => 'Tiket ditugaskan ke ' . $team->name . '.',
                ],
            ]);
        });
    }

    /**
     * GET /me/tickets — daftar tugas tim lapangan.
     */
    public function myTasks(Request $request): JsonResponse
    {
        $user = $request->user();
        $teamIds = $user->teams()->pluck('teams.id');

        $tickets = Ticket::whereIn('assigned_team_id', $teamIds)
            ->where('status', TicketStatus::IN_PROGRESS)
            ->orderByDesc('created_at')
            ->paginate($request->integer('per_page', 20));

        return response()->json($tickets);
    }

    /**
     * POST /tickets/{ticket}/complete — selesaikan tiket dengan foto sesudah.
     */
    public function complete(Request $request, Ticket $ticket): JsonResponse
    {
        Gate::authorize('complete', $ticket);

        $validated = $request->validate([
            'after_photo' => 'required|image|max:5120',
            'note' => 'nullable|string|max:500',
        ]);

        return DB::transaction(function () use ($ticket, $validated, $request) {
            $before = [
                'status' => $ticket->status->value,
            ];

            // Simpan foto "after" ke S3
            $photo = $request->file('after_photo');
            $objectKey = 'photos/after/' . now()->format('Y/m/d') . '/' . uniqid() . '.' . $photo->getClientOriginalExtension();
            $photo->storeAs('photos/after/' . now()->format('Y/m/d'), basename($objectKey), 's3');

            $ticket->photos()->create([
                'type' => 'after',
                'object_key' => $objectKey,
                'sha256' => hash_file('sha256', $photo->getRealPath()),
                'mime_type' => $photo->getMimeType(),
                'size_bytes' => $photo->getSize(),
            ]);

            $ticket->update([
                'status' => TicketStatus::COMPLETED,
                'completed_at' => now(),
            ]);

            $ticket->statusHistories()->create([
                'from_status' => $before['status'],
                'to_status' => TicketStatus::COMPLETED->value,
                'actor_id' => $request->user()->id,
                'note' => $validated['note'] ?? 'Perbaikan selesai.',
            ]);

            AuditLog::create([
                'actor_id' => $request->user()->id,
                'action' => 'complete_ticket',
                'entity_type' => Ticket::class,
                'entity_id' => $ticket->id,
                'before' => $before,
                'after' => [
                    'status' => TicketStatus::COMPLETED->value,
                    'completed_at' => now()->toIso8601String(),
                ],
                'request_id' => $request->header('X-Request-Id'),
            ]);

            // Dispatch notifikasi ke semua warga terhubung
            SendTicketNotification::dispatch($ticket->id, 'completed', 'Perbaikan telah selesai.')
                ->onQueue('notifications');

            return response()->json([
                'data' => [
                    'ticket_id' => $ticket->id,
                    'status' => TicketStatus::COMPLETED->value,
                    'message' => 'Tiket berhasil diselesaikan.',
                ],
            ]);
        });
    }

    /**
     * POST /tickets/{ticket}/confirmation — konfirmasi warga.
     */
    public function confirmation(Request $request, Ticket $ticket): JsonResponse
    {
        Gate::authorize('confirm', $ticket);

        $validated = $request->validate([
            'confirmed' => 'required|boolean',
            'note' => 'nullable|string|max:500',
        ]);

        $user = $request->user();

        // Cek apakah sudah konfirmasi
        $existing = \App\Models\CitizenConfirmation::where('ticket_id', $ticket->id)
            ->where('user_id', $user->id)
            ->first();

        if ($existing) {
            return response()->json([
                'error' => ['message' => 'Anda sudah mengonfirmasi tiket ini.'],
            ], 409);
        }

        \App\Models\CitizenConfirmation::create([
            'ticket_id' => $ticket->id,
            'user_id' => $user->id,
            'confirmed' => $validated['confirmed'],
            'note' => $validated['note'] ?? null,
        ]);

        return response()->json([
            'data' => [
                'ticket_id' => $ticket->id,
                'confirmed' => $validated['confirmed'],
                'message' => $validated['confirmed']
                    ? 'Terima kasih! Perbaikan dikonfirmasi.'
                    : 'Konfirmasi tercatat. Keluhan Anda akan ditindaklanjuti.',
            ],
        ]);
    }
}
