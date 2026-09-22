<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Services\AnalyticsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AnalyticsController extends Controller
{
    /**
     * GET /analytics/summary — KPI dashboard admin.
     */
    public function summary(AnalyticsService $analyticsService): JsonResponse
    {
        $data = $analyticsService->getSummary();

        return response()->json(['data' => $data]);
    }

    /**
     * GET /admin/audit-logs — query log audit (admin only).
     */
    public function auditLogs(Request $request): JsonResponse
    {
        $query = AuditLog::with('actor');

        if ($request->filled('entity_type')) {
            $query->where('entity_type', $request->input('entity_type'));
        }
        if ($request->filled('entity_id')) {
            $query->where('entity_id', $request->input('entity_id'));
        }
        if ($request->filled('action')) {
            $query->where('action', $request->input('action'));
        }
        if ($request->filled('actor_id')) {
            $query->where('actor_id', $request->input('actor_id'));
        }
        if ($request->filled('from') && $request->filled('to')) {
            $query->whereBetween('created_at', [$request->input('from'), $request->input('to')]);
        }

        $logs = $query->orderByDesc('created_at')
            ->paginate($request->integer('per_page', 50));

        return response()->json($logs);
    }
}
