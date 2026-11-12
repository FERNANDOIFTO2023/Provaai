<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

class LoginCode extends Mailable
{
    public const VALID_FOR_MINUTES = 10;

    public function __construct(public readonly string $code) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Seu código de acesso ao Provaai');
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.login-code',
            text: 'emails.login-code-text',
            with: ['validForMinutes' => self::VALID_FOR_MINUTES],
        );
    }
}
