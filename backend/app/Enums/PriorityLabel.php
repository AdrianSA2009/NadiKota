<?php

namespace App\Enums;

enum PriorityLabel: string
{
    case URGENT = 'urgent';
    case WAITING = 'waiting';
    case COMPLETED = 'completed';

    public function label(): string
    {
        return match ($this) {
            self::URGENT => 'Mendesak',
            self::WAITING => 'Menunggu',
            self::COMPLETED => 'Selesai',
        };
    }

    public function color(): string
    {
        return match ($this) {
            self::URGENT => 'red',
            self::WAITING => 'yellow',
            self::COMPLETED => 'green',
        };
    }
}
