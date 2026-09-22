<?php

namespace App\Enums;

enum ReportStatus: string
{
    case SUBMITTED = 'submitted';
    case VALIDATED = 'validated';
    case REJECTED = 'rejected';
    case NEEDS_REVIEW = 'needs_review';

    public function label(): string
    {
        return match ($this) {
            self::SUBMITTED => 'Dikirim',
            self::VALIDATED => 'Divalidasi',
            self::REJECTED => 'Ditolak',
            self::NEEDS_REVIEW => 'Perlu Tinjauan',
        };
    }
}
