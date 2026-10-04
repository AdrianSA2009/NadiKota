<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\TicketStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\TicketResource;
use App\Jobs\SendTicketNotification;
use App\Models\AuditLog;
use App\Models\CitizenConfirmation;
use App\Models\Dispatch;
use App\Models\Team;
use App\Models\Ticket;
use App\Services\ClusteringService;
use App\Services\PriorityService;
use App\Services\SlaCalculator;
use App\Support\PhotoUrl;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class TicketController extends Controller
{
    public function map(Request $request): JsonResponse
    {
        $tickets = Ticket::query()
            // Koordinat diambil sekali lewat select (bukan query ST_X/ST_Y per tiket di resource).
            ->addSelect('tickets.*')
            ->addSelect(DB::raw('ST_Y(location) as lat, ST_X(location) as lng'))
            ->with(['reports.photos', 'reports.latestAiValidation'])
            ->withCount('reporters')
            ->whereNotNull('location')
            // Tiket selesai / dibatalkan / ditolak tidak ditampilkan lagi di peta —
            // peta hanya menampilkan masalah yang masih aktif.
            ->whereNotIn('status', [TicketStatus::COMPLETED, TicketStatus::REJECTED, TicketStatus::CANCELLED])
            ->orderByDesc('priority_score')
            ->limit(min($request->integer('limit', 200), 500))
            ->get();

        return response()->json(['data' => TicketResource::collection($tickets)]);
    }

    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', Ticket::class);

        // eager load foto laporan + AI + bukti after (kartu review/verifikasi) + nama pelapor — hindari N+1
        $query = Ticket::with(['reports.photos', 'reports.latestAiValidation', 'reports.user:id,name', 'photos', 'team:id,name'])
            ->orderByDesc('priority_score');

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }
        if ($request->filled('category')) {
            $query->where('category', $request->input('category'));
        }
        if ($request->filled('from') && $request->filled('to')) {
            $query->whereBetween('created_at', [$request->input('from'), $request->input('to')]);
        }

        $tickets = $query->withCount('reporters')->paginate($request->integer('per_page', 20));

        return response()->json([
            'data' => TicketResource::collection($tickets),
            'meta' => [
                'currentPage' => $tickets->currentPage(),
                'lastPage' => $tickets->lastPage(),
                'total' => $tickets->total(),
            ],
        ]);
    }

    /**
     * Riwayat tiket yang dilaporkan user login — panel kontribusi warga.
     */
    public function myReports(Request $request): JsonResponse
    {
        $user = $request->user();

        $tickets = Ticket::query()
            // lat/lng sekali lewat select — hindari query ST_X/ST_Y per tiket di resource.
            ->addSelect('tickets.*')
            ->addSelect(DB::raw('ST_Y(location) as lat, ST_X(location) as lng'))
            ->with(['reports.photos', 'team:id,name'])
            ->withCount('reporters')
            ->whereHas('reports', fn ($q) => $q->where('user_id', $user->id))
            ->orderByDesc('created_at')
            ->paginate($request->integer('per_page', 50));

        return response()->json([
            'data' => TicketResource::collection($tickets),
            'meta' => [
                'currentPage' => $tickets->currentPage(),
                'lastPage' => $tickets->lastPage(),
                'total' => $tickets->total(),
            ],
        ]);
    }

    public function show(Request $request, Ticket $ticket): JsonResponse
    {
        Gate::authorize('view', $ticket);

        $ticket->load([
            'reports' => fn ($q) => $q->select('id', 'ticket_id', 'user_id', 'category', 'status', 'created_at'),
            'photos',
            'prioritySnapshots',
            'statusHistories',
            'dispatches',
            'team:id,name',
        ]);

        $reporterCount = $ticket->reporters()->count();

        // Foto laporan (laporan → photos.report_id) untuk ringkasan dispatch.
        $ticket->load('reports.photos');

        return response()->json([
            'data' => (new TicketResource($ticket->loadCount('reporters')))->toArray($request) + [
                'reports' => $ticket->reports->map(fn ($r) => [
                    'id' => $r->id,
                    'status' => $r->status instanceof \BackedEnum ? $r->status->value : $r->status,
                    'category' => $r->category instanceof \BackedEnum ? $r->category->value : $r->category,
                    'createdAt' => $r->created_at,
                ]),
                'photos' => $ticket->photos->map(fn ($p) => [
                    'id' => $p->id,
                    'type' => $p->type,
                    'objectKey' => $p->object_key,
                    'photoUrl' => PhotoUrl::make($p->object_key),
                ]),
                'prioritySnapshots' => $ticket->prioritySnapshots,
                'statusHistories' => $ticket->statusHistories,
                'dispatches' => $ticket->dispatches,
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
            'danger_level' => 'nullable|in:bahaya,hati-hati',
        ]);

        return DB::transaction(function () use ($ticket, $validated, $request) {
            $before = [
                'status' => $ticket->status->value,
                'review_status' => $ticket->review_status,
                'danger_level' => $ticket->danger_level,
            ];

            $newStatus = $validated['decision'] === 'approved'
                ? TicketStatus::QUEUED
                : TicketStatus::REJECTED;

            $ticket->update([
                'status' => $newStatus,
                'review_status' => $validated['decision'],
                'danger_level' => $validated['danger_level'] ?? $ticket->danger_level,
                'verified_at' => $validated['decision'] === 'approved' ? now() : null,
                // Batas waktu penyelesaian (SLA) dihitung dari saat tiket disetujui.
                'sla_due_at' => $validated['decision'] === 'approved'
                    ? now()->addDays(SlaCalculator::daysFor($ticket->category))
                    : null,
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
                    'danger_level' => $ticket->danger_level,
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

        $team = Team::findOrFail($validated['team_id']);

        if (! $team->is_active) {
            return response()->json([
                'error' => ['message' => 'Tim tidak aktif.'],
            ], 422);
        }

        return DB::transaction(function () use ($ticket, $validated, $request, $team) {
            // Kunci baris: cegah dua admin dispatch/reassign tiket yang sama bersamaan.
            $locked = Ticket::whereKey($ticket->id)->lockForUpdate()->first();
            if ($locked === null || $locked->status !== TicketStatus::QUEUED) {
                return response()->json([
                    'error' => ['message' => 'Hanya tiket berstatus antrean yang bisa ditugaskan — tiket yang sudah dikerjakan tidak bisa diubah timnya.'],
                ], 409);
            }
            if ($locked->assigned_team_id === $team->id) {
                return response()->json([
                    'error' => ['message' => 'Tiket sudah ditugaskan ke tim tersebut.'],
                ], 409);
            }

            $before = [
                'status' => $locked->status->value,
                'assigned_team_id' => $locked->assigned_team_id,
            ];

            // Penugasan TIDAK langsung mengerjakan — tim menekan "Mulai" (status tetap queued).
            $locked->update([
                'assigned_team_id' => $team->id,
                // Snapshot nama PJ pelaksana — tetap tercatat walau PJ tim diganti nanti.
                'assignee_name' => $team->leader?->name,
            ]);

            $locked->statusHistories()->create([
                'from_status' => $before['status'],
                'to_status' => TicketStatus::QUEUED->value,
                'actor_id' => $request->user()->id,
                'note' => 'Dispatch ke ' . $team->name . ' — menunggu tim mulai.',
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
                    'status' => TicketStatus::QUEUED->value,
                    'assigned_team_id' => $team->id,
                    'team_name' => $team->name,
                ],
                'request_id' => $request->header('X-Request-Id'),
            ]);

            // Dispatch notifikasi ke warga dan tim
            SendTicketNotification::dispatch($ticket->id, 'queued', 'Tim ' . $team->name . ' ditugaskan — menunggu tim mulai mengerjakan.')
                ->onQueue('notifications');

            // Kabar ke anggota tim: tiket baru masuk ke tim mereka.
            \App\Jobs\SendRoleNotification::dispatch([], [
                'type' => 'ticket_received',
                'title' => 'Tiket masuk',
                'body' => "Tiket {$ticket->ticket_number} ditugaskan ke tim Anda.",
                'data' => ['ticket_id' => $ticket->id, 'ticket_number' => $ticket->ticket_number],
            ], $team->members()->pluck('users.id')->all())->onQueue('notifications')->afterCommit();

            return response()->json([
                'data' => [
                    'ticket_id' => $ticket->id,
                    'status' => TicketStatus::QUEUED->value,
                    'team' => [
                        'id' => $team->id,
                        'name' => $team->name,
                    ],
                    'message' => 'Tiket ditugaskan ke ' . $team->name . ' — menunggu tim mulai.',
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
            ->whereIn('status', [TicketStatus::QUEUED->value, TicketStatus::IN_PROGRESS->value])
            ->orderByDesc('created_at')
            ->paginate($request->integer('per_page', 20));

        // Pakai TicketResource (konsisten dgn frontend): camelCase + latitude/longitude
        // (model mentah hanya punya created_at & geometri location → "invalid date"/lokasi kosong).
        return response()->json([
            'data' => TicketResource::collection($tickets),
            'meta' => [
                'currentPage' => $tickets->currentPage(),
                'lastPage' => $tickets->lastPage(),
                'total' => $tickets->total(),
            ],
        ]);
    }

    /**
     * POST /tickets/{ticket}/complete — tim mengirim bukti hasil perbaikan.
     * Status TIDAK berubah (tetap in_progress) — menunggu verifikasi admin (finalize).
     */
    public function complete(Request $request, Ticket $ticket): JsonResponse
    {
        Gate::authorize('complete', $ticket);

        if ($ticket->status !== TicketStatus::IN_PROGRESS) {
            return response()->json([
                'error' => ['message' => 'Hanya tiket dalam perbaikan yang dapat diselesaikan.'],
            ], 409);
        }

        $validated = $request->validate([
            'after_photo' => 'required|image|max:5120',
            'note' => 'nullable|string|max:500',
        ]);

        return DB::transaction(function () use ($ticket, $validated, $request) {
            $before = [
                'status' => $ticket->status->value,
            ];

            // Simpan foto "after" ke disk
            $photo = $request->file('after_photo');
            $objectKey = 'photos/after/' . now()->format('Y/m/d') . '/' . uniqid() . '.' . $photo->getClientOriginalExtension();
            $photo->storeAs('photos/after/' . now()->format('Y/m/d'), basename($objectKey));

            $ticket->photos()->create([
                'type' => 'after',
                'object_key' => $objectKey,
                'sha256' => hash_file('sha256', $photo->getRealPath()),
                'mime_type' => $photo->getMimeType(),
                'size_bytes' => $photo->getSize(),
            ]);

            $ticket->update([
                'status' => TicketStatus::IN_PROGRESS,
                'review_status' => 'submitted',
                'proof_note' => null, // bukti baru menggantikan yang ditolak
            ]);

            $ticket->statusHistories()->create([
                'from_status' => $before['status'],
                'to_status' => TicketStatus::IN_PROGRESS->value,
                'actor_id' => $request->user()->id,
                'note' => $validated['note'] ?? 'Bukti hasil perbaikan dikirim — menunggu verifikasi admin.',
            ]);

            AuditLog::create([
                'actor_id' => $request->user()->id,
                'action' => 'submit_ticket_proof',
                'entity_type' => Ticket::class,
                'entity_id' => $ticket->id,
                'before' => $before,
                'after' => [
                    'status' => TicketStatus::IN_PROGRESS->value,
                    'review_status' => 'submitted',
                ],
                'request_id' => $request->header('X-Request-Id'),
            ]);

            // Dispatch notifikasi ke semua warga terhubung
            SendTicketNotification::dispatch($ticket->id, 'in_progress', 'Tim mengirim bukti hasil perbaikan — menunggu verifikasi admin.')
                ->onQueue('notifications');

            // Kabar ke admin: ada bukti yang menunggu penilaian.
            \App\Jobs\SendRoleNotification::dispatch(['admin', 'super_admin'], [
                'type' => 'ticket_assessment',
                'title' => 'Tiket membutuh penilaian',
                'body' => "Bukti hasil perbaikan {$ticket->ticket_number} sudah dikirim — periksa dan nilai.",
                'data' => ['ticket_id' => $ticket->id, 'ticket_number' => $ticket->ticket_number],
            ])->onQueue('notifications')->afterCommit();

            return response()->json([
                'data' => [
                    'ticket_id' => $ticket->id,
                    'status' => TicketStatus::IN_PROGRESS->value,
                    'review_status' => 'submitted',
                    'message' => 'Bukti hasil perbaikan terkirim — menunggu verifikasi admin.',
                ],
            ]);
        });
    }

    /** POST /tickets/{ticket}/cancel — admin membatalkan tiket aktif dengan alasan audit. */
    /**
     * POST /tickets/{ticket}/finalize — admin memeriksa bukti tim lalu menyelesaikan tiket.
     */
    public function finalize(Request $request, Ticket $ticket): JsonResponse
    {
        Gate::authorize('finalize', $ticket);

        if ($ticket->status !== TicketStatus::IN_PROGRESS) {
            return response()->json([
                'error' => ['message' => 'Hanya tiket dalam perbaikan yang bisa diselesaikan.'],
            ], 409);
        }
        if ($ticket->review_status !== 'submitted' || ! $ticket->photos()->where('type', 'after')->exists()) {
            return response()->json([
                'error' => ['message' => 'Belum ada bukti hasil perbaikan dari tim.'],
            ], 422);
        }

        return DB::transaction(function () use ($ticket, $request) {
            $before = [
                'status' => $ticket->status->value,
                'review_status' => $ticket->review_status,
            ];

            $ticket->update([
                'status' => TicketStatus::COMPLETED,
                'completed_at' => now(),
                'review_status' => 'approved',
            ]);

            $ticket->statusHistories()->create([
                'from_status' => $before['status'],
                'to_status' => TicketStatus::COMPLETED->value,
                'actor_id' => $request->user()->id,
                'note' => 'Hasil perbaikan diverifikasi admin.',
            ]);

            AuditLog::create([
                'actor_id' => $request->user()->id,
                'action' => 'finalize_ticket',
                'entity_type' => Ticket::class,
                'entity_id' => $ticket->id,
                'before' => $before,
                'after' => [
                    'status' => TicketStatus::COMPLETED->value,
                    'completed_at' => now()->toIso8601String(),
                ],
                'request_id' => $request->header('X-Request-Id'),
            ]);

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
     * POST /tickets/{ticket}/start — tim menekan "Mulai" untuk menandai tiket sedang dikerjakan.
     */
    public function start(Request $request, Ticket $ticket): JsonResponse
    {
        Gate::authorize('start', $ticket);

        return DB::transaction(function () use ($ticket, $request) {
            // Kunci baris — cegah dua anggota tim menekan Mulai bersamaan.
            $locked = Ticket::whereKey($ticket->id)->lockForUpdate()->first();
            if ($locked === null || $locked->status !== TicketStatus::QUEUED || $locked->assigned_team_id === null) {
                return response()->json([
                    'error' => ['message' => 'Hanya tiket yang sudah ditugaskan dan belum mulai yang bisa dimulai.'],
                ], 409);
            }

            $locked->update([
                'status' => TicketStatus::IN_PROGRESS,
                'started_at' => now(),
                // Ambil ulang saat mulai — PJ terbaru saat tiket benar-benar dikerjakan.
                'assignee_name' => $locked->team?->leader?->name ?? $locked->assignee_name,
            ]);

            $locked->statusHistories()->create([
                'from_status' => TicketStatus::QUEUED->value,
                'to_status' => TicketStatus::IN_PROGRESS->value,
                'actor_id' => $request->user()->id,
                'note' => 'Tim mulai mengerjakan.',
            ]);

            AuditLog::create([
                'actor_id' => $request->user()->id,
                'action' => 'start_ticket',
                'entity_type' => Ticket::class,
                'entity_id' => $ticket->id,
                'before' => ['status' => TicketStatus::QUEUED->value],
                'after' => ['status' => TicketStatus::IN_PROGRESS->value, 'started_at' => now()->toIso8601String()],
                'request_id' => $request->header('X-Request-Id'),
            ]);

            SendTicketNotification::dispatch($ticket->id, 'in_progress', 'Tim mulai mengerjakan.')
                ->onQueue('notifications');

            return response()->json([
                'data' => [
                    'ticket_id' => $ticket->id,
                    'status' => TicketStatus::IN_PROGRESS->value,
                    'message' => 'Tiket dimulai. Selamat bertugas!',
                ],
            ]);
        });
    }

    /**
     * POST /tickets/{ticket}/reject-proof — admin menolak bukti hasil perbaikan (kurang valid).
     * Status kembali dibaca sebagai pekerjaan berjalan; tim wajib kirim foto ulang.
     */
    public function rejectProof(Request $request, Ticket $ticket): JsonResponse
    {
        Gate::authorize('rejectProof', $ticket);

        if ($ticket->review_status !== 'submitted') {
            return response()->json([
                'error' => ['message' => 'Hanya bukti berstatus menunggu penilaian yang bisa ditolak.'],
            ], 409);
        }

        $validated = $request->validate([
            'reason' => 'required|string|min:3|max:500',
        ]);

        $ticket->update([
            'review_status' => 'proof_rejected',
            'proof_note' => $validated['reason'],
        ]);

        $ticket->statusHistories()->create([
            'from_status' => $ticket->status->value,
            'to_status' => $ticket->status->value,
            'actor_id' => $request->user()->id,
            'note' => 'Bukti hasil perbaikan ditolak admin: ' . $validated['reason'],
        ]);

        AuditLog::create([
            'actor_id' => $request->user()->id,
            'action' => 'reject_ticket_proof',
            'entity_type' => Ticket::class,
            'entity_id' => $ticket->id,
            'before' => ['review_status' => 'submitted'],
            'after' => ['review_status' => 'proof_rejected', 'reason' => $validated['reason']],
            'request_id' => $request->header('X-Request-Id'),
        ]);

        return response()->json([
            'data' => [
                'ticket_id' => $ticket->id,
                'review_status' => 'proof_rejected',
                'message' => 'Bukti ditolak — tim diminta mengirim foto ulang.',
            ],
        ]);
    }

    public function cancel(Request $request, Ticket $ticket): JsonResponse
    {
        Gate::authorize('cancel', $ticket);

        // Tiket yang sudah dikerjakan tim tidak boleh dibatalkan — selesaikan lewat alur bukti.
        if ($ticket->status === TicketStatus::IN_PROGRESS) {
            return response()->json([
                'error' => ['message' => 'Tiket yang sudah mulai dikerjakan tidak bisa dibatalkan. Selesaikan atau tunggu bukti hasil perbaikan.'],
            ], 409);
        }

        $validated = $request->validate([
            'reason' => 'required|string|min:3|max:500',
        ]);

        return DB::transaction(function () use ($ticket, $validated, $request) {
            $before = ['status' => $ticket->status->value];

            $ticket->update([
                'status' => TicketStatus::CANCELLED,
                'cancelled_at' => now(),
                'cancel_reason' => $validated['reason'],
                'sla_due_at' => null, // tiket ditutup — tak perlu lagi dihitung SLA
            ]);
            $ticket->statusHistories()->create([
                'from_status' => $before['status'],
                'to_status' => TicketStatus::CANCELLED->value,
                'actor_id' => $request->user()->id,
                'note' => $validated['reason'],
            ]);
            AuditLog::create([
                'actor_id' => $request->user()->id,
                'action' => 'cancel_ticket',
                'entity_type' => Ticket::class,
                'entity_id' => $ticket->id,
                'before' => $before,
                'after' => [
                    'status' => TicketStatus::CANCELLED->value,
                    'reason' => $validated['reason'],
                ],
                'request_id' => $request->header('X-Request-Id'),
            ]);
            SendTicketNotification::dispatch($ticket->id, 'cancelled', $validated['reason'])
                ->onQueue('notifications');

            return response()->json([
                'data' => [
                    'ticket_id' => $ticket->id,
                    'status' => TicketStatus::CANCELLED->value,
                    'message' => 'Tiket dibatalkan.',
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
        $existing = CitizenConfirmation::where('ticket_id', $ticket->id)
            ->where('user_id', $user->id)
            ->first();

        if ($existing) {
            return response()->json([
                'error' => ['message' => 'Anda sudah mengonfirmasi tiket ini.'],
            ], 409);
        }

        CitizenConfirmation::create([
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
