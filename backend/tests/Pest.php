<?php

use Illuminate\Support\Facades\Http;
use Tests\TestCase;

uses(TestCase::class)->in('Feature', 'Unit');

// Tahan semua panggilan HTTP eksternal (AI icon picker, ip geo, dsb) di test
beforeEach(function (): void {
    Http::fake();
});
