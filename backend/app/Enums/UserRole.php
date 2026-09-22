<?php

namespace App\Enums;

enum UserRole: string
{
    case CITIZEN = 'citizen';
    case ADMIN = 'admin';
    case FIELD_TEAM = 'field_team';
    case SUPER_ADMIN = 'super_admin';

    public function label(): string
    {
        return match ($this) {
            self::CITIZEN => 'Warga',
            self::ADMIN => 'Admin',
            self::FIELD_TEAM => 'Tim Lapangan',
            self::SUPER_ADMIN => 'Super Admin',
        };
    }
}
