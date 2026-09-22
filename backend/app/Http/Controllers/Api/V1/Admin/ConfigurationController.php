<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\PriorityConfiguration;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ConfigurationController extends Controller
{
    /**
     * GET /admin/configuration — ambil konfigurasi aktif.
     */
    public function index(): JsonResponse
    {
        $config = PriorityConfiguration::active()->first();

        if (! $config) {
            return response()->json([
                'data' => null,
                'message' => 'Belum ada konfigurasi aktif.',
            ]);
        }

        return response()->json([
            'data' => [
                'id' => $config->id,
                'version' => $config->version,
                'weights' => $config->weights,
                'clustering_radius_meters' => $config->clustering_radius_meters,
                'ai_accepted_threshold' => $config->ai_accepted_threshold,
                'ai_rejected_threshold' => $config->ai_rejected_threshold,
                'is_active' => $config->is_active,
                'created_at' => $config->created_at,
            ],
        ]);
    }

    /**
     * PUT /admin/configuration — buat versi baru (bukan overwrite).
     */
    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'weights.severity' => 'nullable|integer|min:0|max:100',
            'weights.reporters' => 'nullable|integer|min:0|max:100',
            'weights.road_class' => 'nullable|integer|min:0|max:100',
            'weights.proximity' => 'nullable|integer|min:0|max:100',
            'weights.age' => 'nullable|integer|min:0|max:100',
            'clustering_radius_meters' => 'nullable|numeric|min:15|max:25',
            'ai_accepted_threshold' => 'nullable|numeric|min:0|max:1',
            'ai_rejected_threshold' => 'nullable|numeric|min:0|max:1',
        ]);

        return DB::transaction(function () use ($validated, $request) {
            $currentConfig = PriorityConfiguration::active()->first();
            $currentWeights = $currentConfig?->weights ?? [
                'severity' => 30,
                'reporters' => 20,
                'road_class' => 20,
                'proximity' => 15,
                'age' => 15,
            ];

            $newWeights = array_merge($currentWeights, $validated['weights'] ?? []);

            $newVersion = ($currentConfig?->version ?? 0) + 1;

            // Deactivate current
            if ($currentConfig) {
                $currentConfig->update(['is_active' => false]);
            }

            // Create new version
            $newConfig = PriorityConfiguration::create([
                'version' => $newVersion,
                'weights' => $newWeights,
                'clustering_radius_meters' => $validated['clustering_radius_meters']
                    ?? $currentConfig?->clustering_radius_meters
                    ?? 20,
                'ai_accepted_threshold' => $validated['ai_accepted_threshold']
                    ?? $currentConfig?->ai_accepted_threshold
                    ?? 0.7,
                'ai_rejected_threshold' => $validated['ai_rejected_threshold']
                    ?? $currentConfig?->ai_rejected_threshold
                    ?? 0.3,
                'is_active' => true,
                'actor_id' => $request->user()->id,
            ]);

            // Audit log
            AuditLog::create([
                'actor_id' => $request->user()->id,
                'action' => 'update_configuration',
                'entity_type' => PriorityConfiguration::class,
                'entity_id' => $newConfig->id,
                'before' => $currentConfig ? [
                    'version' => $currentConfig->version,
                    'weights' => $currentConfig->weights,
                    'clustering_radius_meters' => $currentConfig->clustering_radius_meters,
                ] : null,
                'after' => [
                    'version' => $newConfig->version,
                    'weights' => $newConfig->weights,
                    'clustering_radius_meters' => $newConfig->clustering_radius_meters,
                ],
                'request_id' => $request->header('X-Request-Id'),
            ]);

            return response()->json([
                'data' => [
                    'id' => $newConfig->id,
                    'version' => $newConfig->version,
                    'weights' => $newConfig->weights,
                    'clustering_radius_meters' => $newConfig->clustering_radius_meters,
                    'ai_accepted_threshold' => $newConfig->ai_accepted_threshold,
                    'ai_rejected_threshold' => $newConfig->ai_rejected_threshold,
                    'is_active' => $newConfig->is_active,
                    'created_at' => $newConfig->created_at,
                ],
                'message' => 'Konfigurasi baru v' . $newVersion . ' berhasil disimpan.',
            ]);
        });
    }
}
