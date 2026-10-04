<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $duplicates = DB::select(<<<'SQL'
            SELECT LOWER(TRIM(email)) AS normalized_email, COUNT(*) AS total
            FROM users
            WHERE email IS NOT NULL AND TRIM(email) <> ''
            GROUP BY LOWER(TRIM(email))
            HAVING COUNT(*) > 1
            LIMIT 5
        SQL);

        if ($duplicates !== []) {
            $values = implode(', ', array_map(fn ($row) => $row->normalized_email, $duplicates));
            throw new RuntimeException("Cannot add case-insensitive users.email unique index; resolve duplicate normalized emails first: {$values}");
        }

        DB::statement("CREATE UNIQUE INDEX users_email_lower_unique ON users (LOWER(TRIM(email))) WHERE email IS NOT NULL AND TRIM(email) <> ''");
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS users_email_lower_unique');
    }
};
