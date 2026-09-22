<?php

namespace App\Enums;

enum ReportCategory: string
{
    case POTHOLE = 'pothole';
    case STREET_LIGHT = 'street_light';
    case OTHER = 'other';

    public function label(): string
    {
        return match ($this) {
            self::POTHOLE => 'Jalan Berlubang',
            self::STREET_LIGHT => 'Lampu PJU Mati',
            self::OTHER => 'Lainnya',
        };
    }
}
