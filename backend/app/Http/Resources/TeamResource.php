<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;

final class TeamResource extends BaseResource
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function toArray(Request $request): array
    {
        $active = (int) ($this->activeTicketCount ?? 0);
        $total = (int) ($this->totalTicketCount ?? 0);

        // Status turunan: nonaktif > bertugas (ada tiket in_progress) > selesai (semua tugas kelar) > tersedia.
        $status = ! $this->is_active
            ? 'nonaktif'
            : ($active > 0 ? 'bertugas' : ($total > 0 ? 'selesai' : 'tersedia'));

        return [
            'id' => $this->id,
            'name' => $this->name,
            'district' => $this->district,
            'type' => $this->type,
            'description' => $this->description,
            'isActive' => (bool) $this->is_active,
            'userId' => $this->user_id,
            'leader' => $this->whenLoaded('leader', function () {
                if ($this->leader === null) {
                    return null;
                }

                return [
                    'id' => $this->leader->id,
                    'name' => $this->leader->name,
                    'username' => $this->leader->username,
                    'email' => $this->leader->email,
                    'phone' => $this->leader->phone,
                ];
            }),
            'activeTicketCount' => $active,
            // Dipakai frontend mengunci aksi ganti PJ selagi tim sedang mengerjakan (in_progress).
            'inProgressTicketCount' => (int) ($this->in_progress_ticket_count ?? 0),
            'totalTicketCount' => $total,
            'status' => $status,
            'createdAt' => $this->created_at?->toISOString(),
        ];
    }
}
