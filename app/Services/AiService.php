<?php

namespace App\Services;

use App\Models\Exam;
use App\Models\ExamTemplate;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

class AiService
{
    public function configured(): bool
    {
        return config('provaai.provider') === 'mistral' ? (bool) config('provaai.mistral_key') : (bool) (config('provaai.gemini_key') || config('provaai.groq_key'));
    }

    public function generate(string $userId, string $examId, ?\Closure $reportStage = null): Exam
    {
        $lock = Cache::lock('generate:'.$examId, 150);
        if (! $lock->get()) {
            throw new RuntimeException('Esta geração já está em andamento.');
        }
        try {
            $exam = Exam::ownedBy($userId)->findOrFail($examId);
            if (count($exam->content['questions'] ?? [])) {
                return $exam;
            }
            if (! $this->configured()) {
                throw new RuntimeException('Configure a chave de IA no servidor.');
            }
            $objective = $exam->content['objectiveCount'] ?? intdiv($exam->question_count, 2);
            if (! is_int($objective) || $objective < 0 || $objective > $exam->question_count) {
                throw new RuntimeException('Distribuição inválida.');
            }
            $reference = '';
            if ($exam->template_id) {
                $t = ExamTemplate::ownedBy($userId)->findOrFail($exam->template_id);
                if ($t->processing_status !== 'ready') {
                    throw new RuntimeException('Processe o modelo antes de gerar.');
                }
                if (! preg_match('/\.pdf$/i', $t->filename)) {
                    $reference = 'Orientações do professor: '.$t->reference_text."\nAtividade de referência: ".$t->extracted_text;
                }
            }
            $previous = Exam::ownedBy($userId)->where('class_id', $exam->class_id)->where('subject', $exam->subject)->where('topics', $exam->topics)->where('id', '!=', $examId)
                ->when($exam->purpose === 'recovery', fn ($q) => $q->where('student_id', $exam->student_id), fn ($q) => $q->where('title', $exam->title))->orderBy('created_at')->pluck('content');
            $exclude = [];
            foreach ($previous as $p) {
                foreach ($p['questions'] ?? [] as $q) {
                    $exclude[] = $q['statement'];
                }
            }
            $context = ['purpose' => $exam->purpose === 'recovery' ? 'Prova individual' : 'Prova coletiva', 'title' => $exam->title, 'subject' => $exam->subject, 'topics' => $exam->topics,
                'count' => $exam->question_count, 'distribution' => ['objective' => $objective, 'essay' => $exam->question_count - $objective],
                'profile' => array_intersect_key($exam->profile_snapshot, array_flip(['difficulties', 'criteria', 'level'])),
                'reference' => mb_substr($reference, 0, 60000), 'exclude' => array_slice($exclude, -100)];
            $provider = config('provaai.provider') === 'mistral' ? 'mistral' : (config('provaai.gemini_key') ? 'gemini' : 'groq');
            $reportStage?->__invoke('generating');
            $content = app(GeneratedExamContent::class)->prepare($this->ask($provider, 'generation', $context));
            $instructions = trim($exam->content['instructions'] ?? '');
            if ($instructions !== '' && $instructions !== 'Leia com atenção.') {
                $content['instructions'] = $instructions;
            }
            $validator = app(ExamValidator::class);
            $validator->validate($content, $exam->question_count, $objective);
            $seen = array_flip(array_map($validator->normalize(...), $exclude));
            foreach ($content['questions'] as $q) {
                if (isset($seen[$validator->normalize($q['statement'])])) {
                    $validator->fail('Foram detectadas questões repetidas em outra prova.');
                }
            }
            $reportStage?->__invoke('reviewing');
            $review = $this->ask($provider, 'review', ['subject' => $exam->subject, 'topics' => $exam->topics, 'instructions' => $content['instructions'], 'questions' => $content['questions']]);
            if (($review['aligned'] ?? null) !== true || ! isset($review['offTopicQuestions'],$review['missingTopics']) || $review['offTopicQuestions'] !== [] || $review['missingTopics'] !== []) {
                throw new RuntimeException('A conferência não confirmou a matéria e os conteúdos. O rascunho foi preservado.');
            }
            $content['objectiveCount'] = $objective;
            $content = app(MathVerificationService::class)->verify($exam->subject, $content);
            $exam->content = $content;
            $exam->status = 'draft';
            $exam->save();

            return $exam;
        } finally {
            $lock->release();
        }
    }

    private function ask(string &$provider, string $stage, array $context): array
    {
        $instruction = file_get_contents(resource_path('prompts/'.$stage.'.txt'));
        $review = $stage === 'review';
        $hasFallback = (bool) config('provaai.groq_key');
        $start = microtime(true);
        try {
            if ($provider === 'gemini') {
                try {
                    $budget = $hasFallback ? ($review ? 10 : 35) : ($review ? 25 : 90);
                    $model = config('provaai.gemini_model');
                    $generationConfig = ['responseMimeType' => 'application/json', 'maxOutputTokens' => $review ? 2048 : 12000, 'temperature' => $review ? 0 : .7];
                    if (! $review) {
                        $generationConfig['responseJsonSchema'] = app(GeneratedExamContent::class)->schema($context['count'], $context['distribution']['objective']);
                    }
                    $send = fn (int $timeout) => Http::connectTimeout(min(8, $timeout))->timeout($timeout)->withHeaders(['x-goog-api-key' => config('provaai.gemini_key')])
                        ->post('https://generativelanguage.googleapis.com/v1beta/models/'.rawurlencode($model).':generateContent', [
                            'systemInstruction' => ['parts' => [['text' => $instruction]]], 'contents' => [['parts' => [['text' => json_encode($context, JSON_UNESCAPED_UNICODE)]]]],
                            'generationConfig' => $generationConfig,
                        ]);
                    $response = $send($budget);
                    if (! $hasFallback && in_array($response->status(), [500, 502, 503, 504], true) && microtime(true) - $start < 2) {
                        Log::info('gemini_retry', ['stage' => $stage, 'status' => $response->status()]);
                        usleep(300000);
                        $response = $send(max(1, (int) ($budget - (microtime(true) - $start))));
                    }
                    if (! $response->successful()) {
                        Log::warning('gemini_request_failed', ['stage' => $stage, 'model' => $model, 'status' => $response->status()]);
                        if ($hasFallback && (in_array($response->status(), [401, 403, 404, 408, 429]) || $response->serverError())) {
                            throw new ConnectionException('Gemini indisponível');
                        }
                        throw new RuntimeException(match ($response->status()) {
                            429 => 'O Gemini atingiu o limite de uso. Aguarde antes de tentar novamente.',
                            401, 403 => 'O Gemini recusou o acesso. A equipe responsável precisa verificar a chave e as permissões.',
                            404 => 'O modelo do Gemini não está disponível. A equipe responsável precisa verificar a configuração.',
                            408, 500, 502, 503, 504 => 'O Gemini está temporariamente indisponível. Tente novamente neste rascunho em alguns instantes.',
                            default => 'O Gemini não aceitou o pedido. O rascunho foi preservado.',
                        });
                    }
                    $payload = $response->json();
                    $candidate = $payload['candidates'][0] ?? [];
                    if (isset($payload['promptFeedback']['blockReason']) || ($candidate['finishReason'] ?? 'STOP') !== 'STOP') {
                        throw new RuntimeException('O Gemini interrompeu a resposta. Revise o pedido ou reduza a quantidade de questões.');
                    }
                    $text = '';
                    foreach ($candidate['content']['parts'] ?? [] as $p) {
                        if (empty($p['thought'])) {
                            $text .= $p['text'] ?? '';
                        }
                    }

                    return $this->decode($text);
                } catch (ConnectionException $e) {
                    if (! $hasFallback) {
                        throw new RuntimeException('O Gemini demorou demais ou está indisponível.');
                    }
                    $provider = 'groq';
                    Log::info('ai_fallback', ['from' => 'gemini', 'to' => 'groq', 'stage' => $stage]);
                }
            }
            $groq = $provider === 'groq';
            $key = config($groq ? 'provaai.groq_key' : 'provaai.mistral_key');
            if (! $key) {
                throw new RuntimeException('A chave do provedor não está configurada.');
            }
            $body = ['model' => config($groq ? 'provaai.groq_model' : 'provaai.mistral_model'), 'messages' => [['role' => 'system', 'content' => $instruction], ['role' => 'user', 'content' => json_encode($context, JSON_UNESCAPED_UNICODE)]],
                'response_format' => ['type' => 'json_object'], 'temperature' => $review ? 0 : .7];
            if ($groq) {
                $body += ['reasoning_effort' => 'low', 'include_reasoning' => false, 'max_completion_tokens' => $review ? 2048 : 6000];
            } else {
                $body['max_tokens'] = $review ? 2048 : 12000;
            }
            $response = Http::withToken($key)->connectTimeout(8)->timeout($review ? 15 : 40)->post($groq ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://api.mistral.ai/v1/chat/completions', $body);
            if (! $response->successful()) {
                throw new RuntimeException($response->status() === 429 ? 'O provedor atingiu o limite de uso. Aguarde antes de tentar novamente.' : 'O provedor não concluiu a etapa. Confira a configuração e tente novamente.');
            }
            $choice = $response->json('choices.0');
            if (($choice['finish_reason'] ?? null) !== 'stop' || ! empty($choice['message']['refusal'])) {
                throw new RuntimeException('A IA retornou uma resposta incompleta ou recusou o pedido.');
            }

            return $this->decode($choice['message']['content'] ?? '');
        } catch (ConnectionException $e) {
            throw new RuntimeException('A IA demorou demais. O rascunho foi preservado.');
        } finally {
            Log::info('ai_stage', ['provider' => $provider, 'stage' => $stage, 'duration_ms' => round((microtime(true) - $start) * 1000)]);
        }
    }

    private function decode(string $text): array
    {
        try {
            $value = json_decode($text, true, 64, JSON_THROW_ON_ERROR);
        } catch (\Throwable) {
            throw new RuntimeException('A IA retornou conteúdo inválido. Tente novamente.');
        }
        if (! is_array($value)) {
            throw new RuntimeException('Resposta inválida da IA.');
        }

return $value;
    }
}
