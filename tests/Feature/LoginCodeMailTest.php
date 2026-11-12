<?php

namespace Tests\Feature;

use App\Mail\LoginCode;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use RuntimeException;
use Tests\TestCase;

class LoginCodeMailTest extends TestCase
{
    use RefreshDatabase;

    public function test_requested_email_contains_working_code_in_html_and_text_with_embedded_images(): void
    {
        $response = $this->postJson('/api/auth/code', ['action' => 'request', 'email' => 'teacher@example.test'])->assertOk();
        $sent = Mail::mailer()->getSymfonyTransport()->messages()->sole();
        $email = $sent->getOriginalMessage();
        $html = $email->getHtmlBody();
        $plain = $email->getTextBody();
        $this->assertSame('teacher@example.test', $email->getTo()[0]->getAddress());
        $this->assertSame('Seu código de acesso ao Provaai', $email->getSubject());
        $this->assertSame(1, preg_match('/\b[0-9]{6}\b/', $plain, $matches));
        $code = $matches[0];
        $this->assertStringContainsString($code, $html);
        $this->assertStringContainsString('10 minutos', $plain);
        $this->assertStringContainsString('Não compartilhe', $html);
        $this->assertStringNotContainsString('<svg', $html);
        $this->assertStringNotContainsString('<script', $html);
        $this->assertStringNotContainsString('src="http', $html);
        $this->assertCount(2, $email->getAttachments());
        foreach ($email->getAttachments() as $image) {
            $this->assertSame('inline', $image->getDisposition());
            $this->assertContains($image->getMediaSubtype(), ['gif', 'png']);
            $this->assertNotEmpty($image->bodyToString());
        }
        $wire = $sent->toString();
        $this->assertStringContainsString('multipart/alternative', $wire);
        $this->assertStringContainsString('Content-ID:', $wire);
        $this->assertNotSame($code, DB::table('login_codes')->value('digest'));
        $this->postJson('/api/auth/code', ['action' => 'verify', 'email' => 'teacher@example.test', 'code' => $code])
            ->assertOk()->assertJsonPath('session.user.email', 'teacher@example.test');
        $this->assertNotEmpty($response->json('expiresAt'));
    }

    public function test_expired_code_is_rejected_and_new_request_sends_a_new_email(): void
    {
        Mail::fake();
        $this->postJson('/api/auth/code', ['action' => 'request', 'email' => 'teacher@example.test'])->assertOk();
        $code = Mail::sent(LoginCode::class)->sole()->code;
        $this->travel(LoginCode::VALID_FOR_MINUTES)->minutes();
        $this->postJson('/api/auth/code', ['action' => 'verify', 'email' => 'teacher@example.test', 'code' => $code])
            ->assertUnprocessable()->assertJsonPath('code', 'expired_code');
        $this->postJson('/api/auth/code', ['action' => 'request', 'email' => 'teacher@example.test'])
            ->assertOk()->assertJsonPath('reused', false);
        Mail::assertSent(LoginCode::class, 2);
    }

    public function test_rotating_after_five_bad_attempts_sends_the_same_branded_email(): void
    {
        Mail::fake();
        $this->postJson('/api/auth/code', ['action' => 'request', 'email' => 'teacher@example.test'])->assertOk();
        for ($i = 0; $i < 4; $i++) {
            $this->postJson('/api/auth/code', ['action' => 'verify', 'email' => 'teacher@example.test', 'code' => '000000'])->assertUnprocessable();
        }
        $this->postJson('/api/auth/code', ['action' => 'verify', 'email' => 'teacher@example.test', 'code' => '000000'])
            ->assertOk()->assertJsonPath('rotated', true);
        Mail::assertSent(LoginCode::class, 2);
        $code = Mail::sent(LoginCode::class)->last()->code;
        $this->postJson('/api/auth/code', ['action' => 'verify', 'email' => 'teacher@example.test', 'code' => $code])->assertOk();
    }

    public function test_delivery_failure_does_not_store_an_unusable_code(): void
    {
        Mail::shouldReceive('to')->once()->with('teacher@example.test')->andReturnSelf();
        Mail::shouldReceive('send')->once()->with(\Mockery::type(LoginCode::class))->andThrow(new RuntimeException('Test transport unavailable'));
        $this->postJson('/api/auth/code', ['action' => 'request', 'email' => 'teacher@example.test'])
            ->assertStatus(503)->assertJsonPath('code', 'send_failed');
        $this->assertDatabaseCount('login_codes', 0);
    }
}
