<?php

declare(strict_types=1);

use App\Services\OpenAiImageValidator;

it('embeds pixel signals into the AI prompt', function (): void {
    $ref = new ReflectionMethod(OpenAiImageValidator::class, 'buildPrompt');
    $ref->setAccessible(true);
    $validator = new OpenAiImageValidator();

    $withSignals = $ref->invoke($validator, ['periodic_moire_pattern', 'dark_screen_or_phone_edge']);
    expect($withSignals)->toContain('periodic_moire_pattern, dark_screen_or_phone_edge')
        ->not->toContain('{{PIXEL_SIGNALS}}');

    $withoutSignals = $ref->invoke($validator, []);
    expect($withoutSignals)->toContain('tidak ada sinyal piksel layar')
        ->not->toContain('{{PIXEL_SIGNALS}}');
});
