<?php

namespace App\Enums;

enum TicketStatus: string
{
    case REPORTED = 'reported';
    case VALIDATED = 'validated';
    case IN_QUEUE = 'in_queue';
    case IN_PROGRESS = 'in_progress';
    case COMPLETED = 'completed';
    case REJECTED = 'rejected';
    case NEEDS_REVIEW = 'needs_review';

    public function label(): string
    {
        return match ($this) {
            self::REPORTED => 'Dilaporkan',
            self::VALIDATED => 'Diverifikasi',
            self::IN_QUEUE => 'Dalam Antrean',
            self::IN_PROGRESS => 'Dalam Perbaikan',
            self::COMPLETED => 'Selesai',
            self::REJECTED => 'Ditolak',
            self::NEEDS_REVIEW => 'Perlu Tinjauan',
        };
    }

    public function color(): string
    {
        return match ($this) {
            self::REPORTED => 'blue',
            self::VALIDATED => 'cyan',
            self::IN_QUEUE => 'yellow',
            self::IN_PROGRESS => 'orange',
            self::COMPLETED => 'green',
            self::REJECTED => 'red',
            self::NEEDS_REVIEW => 'purple',
        };
    }

    public function isActive(): bool
    {
        return ! in_array($this, [self::COMPLETED, self::REJECTED]);
    }
}
