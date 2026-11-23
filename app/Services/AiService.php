<?php

/*
 * Serviços / geração e revisão por IA
 * Monta o contexto pedagógico, chama o provedor e valida a resposta antes de persistir. A
 * conferência de conteúdo e a verificação matemática mantêm a prova como rascunho para revisão
 * humana.
 */


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
    /** Informa disponibilidade de configuração; não testa a validade das chaves no provedor. */
    public function configured(): bool
    {
        return config('provaai.provider') === 'mistral' ? (bool) config('provaai.mistral_key') : (bool) (config('provaai.gemini_key') || config('provaai.groq_key'));
    }

    /** Gera somente rascunho vazio sob bloqueio; valida estrutura, repetição e aderência antes de salvar. */
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
            // Envia somente os campos pedagógicos do perfil; nome e código do aluno ficam fora deste contexto.
            $context = ['purpose' => $exam->purpose === 'recovery' ? 'Prova individual' : 'Prova coletiva', 'title' => $exam->title, 'subject' => $exam->subject, 'topics' => $exam->topics,
                'count' => $exam->question_count, 'distribution' => ['objective' => $objective, 'essay' => $exam->question_count - $objective],
                'profile' => array_intersect_key($exam->profile_snapshot, array_flip(['difficulties', 'criteria', 'level'])),
                'reference' => mb_substr($reference, 0, 60000), 'exclude' => array_slice($exclude, -100)];
            $provider = config('provaai.provider') === 'mistral' ? 'mistral' : (config('provaai.gemini_key') ? 'gemini' : 'groq');
            $sources = $exam->source_snapshot;
            $research = null;
            if ($sources) {
                if (empty($sources['materials'])) throw new RuntimeException('Os materiais desta prova estão indisponíveis. Prepare uma nova prova.');
                $context['sources'] = $sources;
                if (!empty($sources['allow_external'])) {
                    $research = app(ExternalResearch::class)->find($userId, $exam->class_id, $exam->subject, $exam->topics);
                    $context['external_research'] = $research['text'];
                } else {
                    // Modelo de diagramação não pode introduzir matéria fora dos anexos no modo restrito.
                    $context['reference'] = '';
                }
            }
            $reportStage?->__invoke('generating');
            $content = app(GeneratedExamContent::class)->prepare($this->ask($provider, 'generation', $context, $userId));
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
            // A segunda chamada confere matéria e tópicos. Ela não aprova a prova para download.
            $reviewContext = ['subject' => $exam->subject, 'topics' => $exam->topics, 'instructions' => $content['instructions'], 'questions' => $content['questions']];
            if ($sources) $reviewContext['sources'] = $sources;
            if ($research) $reviewContext['external_research'] = $research['text'];
            $review = $this->ask($provider, 'review', $reviewContext, $userId);
            if (($review['aligned'] ?? null) !== true || ! isset($review['offTopicQuestions'],$review['missingTopics']) || $review['offTopicQuestions'] !== [] || $review['missingTopics'] !== []) {
                throw new RuntimeException('A conferência não confirmou a matéria e os conteúdos. O rascunho foi preservado.');
            }
            $content['objectiveCount'] = $objective;
            if ($sources && empty($sources['allow_external']) && (($review['sourcesGrounded'] ?? null) !== true || ($review['offSourceQuestions'] ?? null) !== [])) {
                throw new RuntimeException('A conferência encontrou conteúdo sem apoio nos anexos. O rascunho foi preservado. Confira os materiais e os tópicos solicitados.');
            }
            $content = app(MathVerificationService::class)->verify($exam->subject, $content);
            $exam->content = $content;
            $exam->external_research = $research;
            $exam->status = 'draft';
            $exam->save();

            return $exam;
        } finally {
            $lock->release();
        }
    }

    /** Executa geração ou revisão com prazos próprios e fallback de Gemini para Groq quando configurado. */
    private function ask(string &$provider, string $stage, array $context, string $userId): array
    {
        $instruction = file_get_contents(resource_path('prompts/'.$stage.'.txt'));
        $review = $stage === 'review';
        $hasFallback = (bool) config('provaai.groq_key');
        $start = microtime(true);
        try {
            if ($provider === 'gemini') {
                try {
                    $budget = $hasFallback ? ($review ? 10 : 35) : ($review ? 25 : 90);
                    // Reserva tempo para a pesquisa opcional sem ampliar o prazo da fila existente.
                    if (!empty($context['sources']['allow_external'])) $budget = min($budget, $review ? 20 : 75);
                    $model = config('provaai.gemini_model');
                    $generationConfig = ['responseMimeType' => 'application/json', 'maxOutputTokens' => $review ? 2048 : 12000, 'temperature' => $review ? 0 : .7];
                    if (! $review) {
                        $generationConfig['responseJsonSchema'] = app(GeneratedExamContent::class)->schema($context['count'], $context['distribution']['objective']);
                    }
                    $send = fn (int $timeout) => app(AiUsage::class)->request($userId, 'gemini', $model, $stage, fn () => Http::connectTimeout(min(8, $timeout))->timeout($timeout)->withHeaders(['x-goog-api-key' => config('provaai.gemini_key')])
                        ->post('https://generativelanguage.googleapis.com/v1beta/models/'.rawurlencode($model).':generateContent', [
                            'systemInstruction' => ['parts' => [['text' => $instruction]]], 'contents' => [['parts' => [['text' => json_encode($context, JSON_UNESCAPED_UNICODE)]]]],
                            'generationConfig' => $generationConfig,
                        ]));
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
                    // A troca vale também para as próximas etapas desta geração, pois provider é passado por referência.
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
            $response = app(AiUsage::class)->request($userId, $provider, $body['model'], $stage, fn () => Http::withToken($key)->connectTimeout(8)->timeout($review ? 15 : 40)->post($groq ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://api.mistral.ai/v1/chat/completions', $body));
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

    /** Exige uma resposta JSON estruturada e converte falhas do provedor em mensagem compreensível. */
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
