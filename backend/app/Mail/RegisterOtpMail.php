<?php

declare(strict_types=1);

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Email OTP registrasi — tampilan HTML (butuh view, karena styling inline).
 */
final class RegisterOtpMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly string $otp,
        public readonly int $expiryMinutes,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Kode Verifikasi NadiKota');
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.register-otp',
            with: ['otp' => $this->otp, 'expiryMinutes' => $this->expiryMinutes],
        );
    }
}