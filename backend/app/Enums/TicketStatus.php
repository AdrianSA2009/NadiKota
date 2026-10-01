<?php

namespace App\Enums;

enum TicketStatus: string
{
    case REPORTED = 'reported';
    case VERIFIED = 'verified';
    case QUEUED = 'queued';
    case IN_PROGRESS = 'in_progress';
    case COMPLETED = 'completed';
    case REJECTED = 'rejected';
    case CANCELLED = 'cancelled';
    case NEEDS_REVIEW = 'needs_review';

    public function label(): string
    {
        return match ($this) {
            self::REPORTED => 'Dilaporkan',
            self::VERIFIED => 'Diverifikasi',
            self::QUEUED => 'Dalam Antrean',
            self::IN_PROGRESS => 'Dalam Perbaikan',
            self::COMPLETED => 'Selesai',
            self::REJECTED => 'Ditolak',
            self::CANCELLED => 'Dibatalkan',
            self::NEEDS_REVIEW => 'Perlu Tinjauan',
        };
    }

    public function color(): string
    {
        return match ($this) {
            self::REPORTED => 'blue',
            self::VERIFIED => 'cyan',
            self::QUEUED => 'yellow',
            self::IN_PROGRESS => 'orange',
            self::COMPLETED => 'green',
            self::REJECTED => 'red',
            self::CANCELLED => 'gray',
            self::NEEDS_REVIEW => 'purple',
        };
    }

    public function isActive(): bool
    {
        return ! in_array($this, [self::COMPLETED, self::REJECTED, self::CANCELLED]);
    }
}
