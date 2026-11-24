<?php

namespace Tests\Feature;

use App\Services\GeminiRetry;
use GuzzleHttp\Psr7\Response as PsrResponse;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Tests\TestCase;

class GeminiRetryTest extends TestCase
{
    /** Relógio controlado: prova os limites sem esperar nem acessar provedores reais. */
    private function retry(): GeminiRetry
    {
        return new class extends GeminiRetry {
            public float $clock = 0;
            public array $waits = [];
            protected function now(): float { return $this->clock; }
            protected function jitter(): float { return 0; }
            protected function pause(float $seconds): void { $this->waits[] = $seconds; $this->clock += $seconds; }
        };
    }

    private function response(int $status, array $headers = []): Response
    {
        return new Response(new PsrResponse($status, $headers));
    }

    public function test_slow_transient_failures_recover_with_backoff_and_remaining_budget(): void
    {
        $retry = $this->retry();
        $timeouts = [];
        $result = $retry->send(function ($timeout) use ($retry, &$timeouts) {
            $timeouts[] = $timeout;
            $retry->clock += 3;
            return $this->response(count($timeouts) < 3 ? 503 : 200);
        }, 25, 'review');
        $this->assertSame(200, $result->status());
        $this->assertSame([25, 21, 16], $timeouts);
        $this->assertEquals([1, 2], $retry->waits);
    }

    public function test_persistent_outage_stops_after_three_calls(): void
    {
        $retry = $this->retry();
        $calls = 0;
        $response = $retry->send(function () use (&$calls) { $calls++; return $this->response(503); }, 90, 'generation');
        $this->assertSame(503, $response->status());
        $this->assertSame(3, $calls);
    }

    public function test_auth_quota_and_invalid_requests_are_not_retried(): void
    {
        foreach ([200, 400, 401, 403, 404, 429] as $status) {
            $retry = $this->retry();
            $calls = 0;
            $retry->send(function () use (&$calls, $status) { $calls++; return $this->response($status); }, 25, 'review');
            $this->assertSame(1, $calls);
            $this->assertSame([], $retry->waits);
        }
    }

    public function test_retry_after_is_respected_and_cannot_extend_deadline(): void
    {
        foreach ([4 => 2, 20 => 1] as $delay => $expectedCalls) {
            $retry = $this->retry();
            $calls = 0;
            $retry->send(function () use (&$calls, $delay) {
                return $this->response(++$calls === 1 ? 503 : 200, ['Retry-After' => (string) $delay]);
            }, 10, 'research');
            $this->assertSame($expectedCalls, $calls);
            $this->assertEquals($expectedCalls === 2 ? [$delay] : [], $retry->waits);
        }
    }

    public function test_exhausted_request_budget_does_not_start_another_call(): void
    {
        $retry = $this->retry();
        $calls = 0;
        $retry->send(function () use ($retry, &$calls) { $calls++; $retry->clock += 9; return $this->response(503); }, 10, 'research');
        $this->assertSame(1, $calls);
        $this->assertSame([], $retry->waits);
    }

    public function test_connection_failure_can_recover_but_direct_fallback_does_not_wait(): void
    {
        $retry = $this->retry();
        $calls = 0;
        $result = $retry->send(function () use (&$calls) {
            if (++$calls === 1) throw new ConnectionException('Synthetic failure');
            return $this->response(200);
        }, 10, 'research');
        $this->assertSame(200, $result->status());
        $direct = $this->retry();
        try {
            $direct->send(fn () => throw new ConnectionException('Synthetic failure'), 10, 'review', 1);
            $this->fail('A falha deve seguir para o provedor reserva.');
        } catch (ConnectionException) {
            $this->assertSame([], $direct->waits);
        }
    }
}
