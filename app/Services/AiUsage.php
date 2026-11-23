<?php

namespace App\Services;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/** Mede cada chamada efetiva, inclusive tentativas e fallback; cache local não cria consumo fictício. */
class AiUsage
{
    public function request(string $uid, string $provider, string $model, string $stage, callable $send): Response
    {
        $start = hrtime(true);
        $response = null;
        try {
            return $response = $send();
        } finally {
            // Falhas no registro de telemetria não podem perder uma prova que o provedor já gerou.
            try {
                $usage = $response?->json($provider === 'gemini' ? 'usageMetadata' : 'usage') ?? [];
                $count = static fn ($value) => is_int($value) && $value >= 0 ? $value : null;
                DB::table('ai_usage_events')->insert([
                    'user_id' => $uid, 'provider' => $provider, 'model' => mb_substr($model, 0, 150), 'stage' => $stage,
                    'input_tokens' => $count($usage[$provider === 'gemini' ? 'promptTokenCount' : 'prompt_tokens'] ?? null),
                    'output_tokens' => $count($usage[$provider === 'gemini' ? 'candidatesTokenCount' : 'completion_tokens'] ?? null),
                    // Usa o total informado: Gemini pode incluir raciocínio e ferramentas além de entrada/saída.
                    'total_tokens' => $count($usage[$provider === 'gemini' ? 'totalTokenCount' : 'total_tokens'] ?? null),
                    'duration_ms' => min(4294967295, (int) round((hrtime(true) - $start) / 1_000_000)),
                    'http_status' => $response?->status(), 'created_at' => now(),
                ]);
            } catch (\Throwable) {
                Log::warning('ai_usage_record_failed', ['provider' => $provider, 'stage' => $stage]);
            }
        }
    }
}
