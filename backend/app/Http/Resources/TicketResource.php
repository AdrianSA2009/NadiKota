<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Support\PhotoUrl;
use Illuminate\Http\Request;

final class TicketResource extends BaseResource
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function toArray(Request $request): array
    {
        $latitude = null;
        $longitude = null;

        if ($this->location !== null) {
            $coords = \DB::select('SELECT ST_X(location) AS lng, ST_Y(location) AS lat FROM tickets WHERE id = ?', [$this->id]);
            if ($coords !== []) {
                $latitude = (float) $coords[0]->lat;
                $longitude = (float) $coords[0]->lng;
            }
        }

        return [
            'id' => $this->id,
            'ticketNumber' => $this->ticket_number,
            'category' => $this->category instanceof \BackedEnum ? $this->category->value : $this->category,
            'status' => $this->status instanceof \BackedEnum ? $this->status->value : $this->status,
            'reviewStatus' => $this->review_status,
            'priorityScore' => (float) $this->priority_score,
            'priorityLabel' => $this->priority_label instanceof \BackedEnum ? $this->priority_label->value : $this->priority_label,
            'dangerLevel' => $this->danger_level,
            // Foto bukti hasil perbaikan (dikirim tim) — untuk "Cek hasilnya" admin.
            'afterPhotoUrl' => $this->whenLoaded('photos', function () {
                $after = $this->photos->where('type', 'after')->sortByDesc('id')->first();

                return $after !== null ? PhotoUrl::make($after->object_key) : null;
            }),
            // Foto + analisis AI laporan terakhir (hanya saat eager load — kartu review)
            'photoUrl' => $this->whenLoaded('reports', function () {
                $key = $this->reports->sortBy('id')->first()?->photos->first()?->object_key;

                return $key !== null ? PhotoUrl::make($key) : null;
            }),
            'aiAnalysis' => $this->whenLoaded('reports', function () {
                $validation = $this->reports->sortBy('id')->last()?->latestAiValidation;
                if ($validation === null) {
                    return null;
                }
                $result = $validation->result ?? [];

                return [
                    'decision' => $validation->decision instanceof \BackedEnum ? $validation->decision->value : $validation->decision,
                    'severity' => $result['severity'] ?? null,
                    'confidence' => $validation->confidence !== null ? (float) $validation->confidence : null,
                    'reason' => $result['reason'] ?? null,
                    'model' => $validation->model,
                ];
            }),
            'assignedTeamId' => $this->assigned_team_id,
            // Nama tim yang ditugaskan mengerjakan tiket ini.
            'assignedTeamName' => $this->whenLoaded('team', fn () => $this->team?->name),
            // Nama pelapor (laporan pertama → terbaru, unik) — bukan sekadar jumlah.
            'reporterNames' => $this->whenLoaded('reports', function () {
                return $this->reports->sortBy('id')->pluck('user.name')->filter()->unique()->values()->all();
            }),
            // Nama PJ yang menangani tiket (snapshot saat dispatch/mulai — tidak ikut PJ diganti).
            'assigneeName' => $this->assignee_name,
            'uniqueReporterCount' => $this->whenCounted('reporters'),
            'latitude' => $latitude,
            'longitude' => $longitude,
            'verifiedAt' => $this->verified_at?->toISOString(),
            'startedAt' => $this->started_at?->toISOString(),
            'completedAt' => $this->completed_at?->toISOString(),
            'cancelledAt' => $this->cancelled_at?->toISOString(),
            'cancelReason' => $this->cancel_reason,
            'proofNote' => $this->proof_note,
            'slaDueAt' => $this->sla_due_at?->toISOString(),
            'createdAt' => $this->created_at?->toISOString(),
            'updatedAt' => $this->updated_at?->toISOString(),
        ];
    }
}
