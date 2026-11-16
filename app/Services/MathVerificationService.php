<?php

/*
 * Serviços / ponte para o verificador matemático
 * Descarta pareceres recebidos do navegador ou da IA e executa o verificador Python com prazo
 * limitado. Falha ou notação não coberta exige revisão humana, sem declarar a questão correta.
 */


namespace App\Services;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Symfony\Component\Process\Process;
use Throwable;

class MathVerificationService
{
    /** Recalcula o parecer para matérias reconhecidas e associa cada resultado à entrada exata conferida. */
    public function verify(string $subject, array $content): array
    {
        // Pareceres fornecidos pelo navegador ou pelo modelo de linguagem não são considerados confiáveis.
        unset($content['mathReview']);
        if (! preg_match('/\b(matematicas?|mathematics|math|calculo|algebra|geometria|aritmetica|trigonometria|estatistica)\b/', Str::lower(Str::ascii($subject))) || empty($content['questions'])) {
            return $content;
        }

        $inputs = array_map(fn ($q) => array_intersect_key($q, array_flip(['statement', 'type', 'options', 'answer'])), $content['questions']);
        $fallback = ['status' => 'needs_review', 'message' => 'Conferência automática indisponível. Revise o cálculo e o gabarito.'];
        $results = array_fill(0, count($inputs), $fallback);
        try {
            $process = new Process([config('provaai.python_binary'), base_path('scripts/verify-math.py')]);
            $process->setInput(json_encode(['questions' => $inputs, 'instructions' => $content['instructions'] ?? ''], JSON_THROW_ON_ERROR));
            $process->setTimeout(6);
            $process->mustRun();
            $decoded = json_decode($process->getOutput(), true, 32, JSON_THROW_ON_ERROR);
            if (! is_array($decoded) || count($decoded) !== count($inputs)) {
                throw new \RuntimeException('Invalid math report');
            }
            foreach ($decoded as $result) {
                if (! in_array($result['status'] ?? '', ['verified', 'mismatch', 'needs_review'], true) || ! is_string($result['message'] ?? null)) {
                    throw new \RuntimeException('Invalid math result');
                }
            }
            $results = $decoded;
        } catch (Throwable $e) {
            // Não inclui conteúdo dos alunos, saída do subprocesso nem credenciais nos registros.
            Log::warning('math_verification_unavailable', ['exception' => $e::class]);
        }
        $content['mathReview'] = ['version' => 1, 'subject' => $subject, 'instructions' => $content['instructions'] ?? '', 'results' => []];
        foreach ($inputs as $index => $input) {
            $content['mathReview']['results'][] = [...$results[$index], 'input' => $input];
        }

        return $content;
    }
}
