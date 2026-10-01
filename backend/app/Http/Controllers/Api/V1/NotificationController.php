<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    /**
     * GET /me/notifications — daftar notifikasi user login.
     */
    public function index(Request $request): JsonResponse
    {
        $notifications = Notification::where('user_id', $request->user()->id)
            ->orderByDesc('created_at')
            ->paginate($request->integer('per_page', 20));

        return response()->json($notifications);
    }

    /**
     * GET /me/notifications/unread-count — jumlah belum dibaca (total + per tipe) untuk badge tab menu.
     */
    public function unreadCount(Request $request): JsonResponse
    {
        $unread = Notification::where('user_id', $request->user()->id)
            ->where('is_read', false);

        $byType = (clone $unread)
            ->selectRaw('type, count(*) as total')
            ->groupBy('type')
            ->pluck('total', 'type');

        return response()->json([
            'count' => (clone $unread)->count(),
            'by_type' => $byType,
        ]);
    }

    /**
     * PUT /me/notifications/{notification}/read — tandai sudah dibaca.
     */
    public function markRead(Request $request, Notification $notification): JsonResponse
    {
        if ($notification->user_id !== $request->user()->id) {
            abort(403, 'Forbidden.');
        }

        $notification->markAsRead();

        return response()->json(['message' => 'Notifikasi ditandai sudah dibaca.']);
    }

    /**
     * PUT /me/notifications/read-all — tandai semua sudah dibaca (opsional: spesifik satu tipe).
     */
    public function markAllRead(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'type' => 'nullable|string|max:50',
        ]);

        $query = Notification::where('user_id', $request->user()->id)
            ->where('is_read', false);

        if (! empty($validated['type'])) {
            $query->where('type', $validated['type']);
        }

        $query->update(['is_read' => true, 'read_at' => now()]);

        return response()->json(['message' => 'Notifikasi ditandai sudah dibaca.']);
    }
}
