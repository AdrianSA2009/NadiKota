<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function defineDatabaseMigrations(): void
    {
        $this->artisan('migrate:fresh');
        $this->artisan('migrate', [
            '--path' => 'database/migrations/nadi_kota',
            '--realpath' => true,
        ]);
    }
}
