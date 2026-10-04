<?php

declare(strict_types=1);

use App\Mail\RegisterOtpMail;

it('renders the NadiKota logo as a public absolute URL with email-safe dimensions', function (): void {
    $html = (new RegisterOtpMail('123456', 5))->render();

    expect($html)
        ->toContain('alt="Logo NadiKota"')
        ->toContain('width="44"')
        ->toContain('height="44"')
        ->toContain('/logo-email-88.png')
        ->not->toContain('cid:')
        ->not->toContain('data:image');
});
