<?php

namespace App\Enums;

enum AiDecision: string
{
    case ACCEPTED = 'accepted';
    case REJECTED = 'rejected';
    case SUSPICIOUS = 'suspicious';

    public function label(): string
    {
        return match ($this) {
            self::ACCEPTED => 'Diterima',
            self::REJECTED => 'Ditolak',
            self::SUSPICIOUS => 'Meragukan',
        };
    }
}
