<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Log;

/** Repete somente falhas transitórias, compartilhando o prazo entre todas as tentativas. */
class GeminiRetry
{
    public function send(callable $request, int $budget, string $stage, int $attempts = 3): Response
    {
        $deadline = $this->now() + $budget;
        for ($attempt = 1; ; $attempt++) {
            $response = null;
            $failure = null;
            try {
                $response = $request(max(1, (int) floor($deadline - $this->now())));
            } catch (ConnectionException $exception) {
                $failure = $exception;
            }

            // Autenticação, cota e conteúdo inválido exigem outra ação, não mais chamadas.
            if ($response && !in_array($response->status(), [408, 500, 502, 503, 504], true)) {
                return $response;
            }
            $delay = 2 ** ($attempt - 1) + $this->jitter();
            $retryAfter = $response?->header('Retry-After');
            if ($retryAfter !== null && $retryAfter !== '') {
                $seconds = is_numeric($retryAfter) ? (float) $retryAfter : max(0, (strtotime($retryAfter) ?: time()) - time());
                $delay = max($delay, $seconds);
            }
            // Reserva ao menos um segundo de requisição; nunca amplia o prazo da etapa/fila.
            if ($attempt >= $attempts || $deadline - $this->now() < $delay + 1) {
                if ($failure) throw $failure;
                return $response;
            }
            Log::info('gemini_retry', ['stage' => $stage, 'attempt' => $attempt + 1,
                'status' => $response?->status(), 'delay_ms' => (int) round($delay * 1000)]);
            $this->pause($delay);
            // O processo pode ter sido suspenso pelo sistema durante a espera.
            if ($deadline - $this->now() < 1) {
                if ($failure) throw $failure;
                return $response;
            }
        }
    }

    protected function now(): float
    {
        return hrtime(true) / 1e9;
    }

    protected function jitter(): float
    {
        return random_int(0, 250) / 1000;
    }

    protected function pause(float $seconds): void
    {
        usleep((int) ceil($seconds * 1e6));
    }
}
