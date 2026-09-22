<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Ticket;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class DispatchController extends Controller
{
    public function assign(Request $request, Ticket $ticket): JsonResponse
    {
        $request->validate([
            'team_id' => 'required|exists:teams,id',
        ]);

        $ticket->update([
            'assigned_team_id' => $request->input('team_id'),
            'status' => 'in_progress',
            'started_at' => now(),
        ]);

        // TODO: dispatch notification job

        return response()->json(['message' => 'Tim ditugaskan.', 'data' => $ticket]);
    }
}
