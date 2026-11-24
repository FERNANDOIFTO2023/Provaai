<?php

/*
 * Testes / backend
 * Cobre geração, revisão, respostas inválidas e indisponibilidade dos provedores de IA.
 * Usa o ambiente de testes do Laravel; os cenários devem permanecer independentes de credenciais e
 * dados de produção.
 */


namespace Tests\Feature;

use App\Models\ClassRoom;
use App\Jobs\GenerateBatchStep;
use App\Models\Exam;
use App\Models\ExamBatch;
use App\Models\ExamTemplate;
use App\Models\Student;
use App\Models\User;
use App\Services\AiService;
use App\Services\BatchService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Tests\TestCase;

class AiTest extends TestCase
{
    use RefreshDatabase;

    private function exam(): Exam
    {
        $u = User::factory()->create();
        $r = new ClassRoom;
        $r->forceFill(['user_id' => $u->id, 'name' => '7º A', 'grade' => '7', 'subject' => 'Ciências'])->save();
        $s = new Student;
        $s->forceFill(['user_id' => $u->id, 'class_id' => $r->id, 'name' => 'PRIVATE NAME', 'code' => 'PRIVATE CODE'])->save();
        $e = new Exam;
        $e->forceFill(['user_id' => $u->id, 'class_id' => $r->id, 'student_id' => $s->id, 'title' => 'Plantas', 'subject' => 'Ciências', 'topics' => 'Fotossíntese', 'question_count' => 1,
            'content' => ['instructions' => 'Responda.', 'questions' => [], 'objectiveCount' => 0], 'profile_snapshot' => ['name' => $s->name, 'code' => $s->code, 'level' => 'Intermediário', 'criteria' => '', 'difficulties' => '']])->save();

        return $e;
    }

    private function content(): array
    {
        return ['instructions' => 'Responda.', 'questions' => [['type' => 'essay', 'statement' => 'Explique a fotossíntese.', 'options' => [], 'answer' => 'Produção de açúcares com luz.', 'objective' => 'Compreender a fotossíntese', 'points' => 10]]];
    }

    public function test_repeated_options_are_replaced_once_and_all_ten_questions_are_reviewed(): void
    {
        config(['provaai.gemini_key' => null, 'provaai.groq_key' => 'test']);
        $exam = $this->exam();
        $sources = ['allow_external' => false, 'materials' => [['text' => 'Material fictício de fotossíntese.']]];
        $exam->forceFill(['question_count' => 10, 'content' => ['instructions' => 'Instrução do professor.', 'questions' => [], 'objectiveCount' => 10], 'source_snapshot' => $sources])->save();
        $questions = [];
        for ($i = 0; $i < 10; $i++) $questions[] = ['type' => 'objective', 'statement' => 'Questão original número '.$i,
            'options' => ['luz', 'vento', 'solo', 'chuva'], 'answerIndex' => 0, 'objective' => 'Fotossíntese', 'points' => 1];
        $questions[0]['options'][1] = ' luz ';
        $questions[7]['options'][2] = 'vento';
        $calls = 0;
        Http::fake(function ($request) use (&$calls, $questions, $sources) {
            $ctx = json_decode($request['messages'][1]['content'], true);
            $this->assertSame($sources, $ctx['sources']);
            $this->assertStringNotContainsString('PRIVATE NAME', $request->body());
            $calls++;
            if ($calls === 1) $result = ['instructions' => 'IA', 'questions' => $questions];
            elseif ($calls === 2) {
                $this->assertSame(2, $ctx['count']);
                $this->assertSame(['objective' => 2, 'essay' => 0], $ctx['distribution']);
                $this->assertContains($questions[1]['statement'], $ctx['exclude']);
                $replacement = $questions[1];
                $replacement['statement'] = 'Primeira questão substituta';
                $second = $replacement;
                $second['statement'] = 'Segunda questão substituta';
                $result = ['instructions' => 'IA', 'questions' => [$replacement, $second]];
            } else {
                $this->assertCount(10, $ctx['questions']);
                $this->assertSame('Primeira questão substituta', $ctx['questions'][0]['statement']);
                $this->assertSame('Segunda questão substituta', $ctx['questions'][7]['statement']);
                $this->assertSame($questions[1]['statement'], $ctx['questions'][1]['statement']);
                $this->assertSame('Instrução do professor.', $ctx['instructions']);
                $result = ['aligned' => true, 'offTopicQuestions' => [], 'missingTopics' => [], 'sourcesGrounded' => true, 'offSourceQuestions' => []];
            }
            return Http::response(['choices' => [['finish_reason' => 'stop', 'message' => ['content' => json_encode($result)]]]]);
        });
        $saved = app(AiService::class)->generate($exam->user_id, $exam->id);
        $this->assertCount(10, $saved->content['questions']);
        $this->assertSame(10, array_sum(array_column($saved->content['questions'], 'points')));
        Http::assertSentCount(3);
    }

    public function test_invalid_repair_does_not_loop_or_save_repeated_options(): void
    {
        config(['provaai.gemini_key' => null, 'provaai.groq_key' => 'test']);
        $exam = $this->exam();
        $exam->forceFill(['content' => ['instructions' => '', 'questions' => [], 'objectiveCount' => 1]])->save();
        $invalid = ['instructions' => '', 'questions' => [['statement' => 'Questão inválida de teste', 'type' => 'objective',
            'options' => ['luz', 'luz', 'terra', 'vento'], 'answerIndex' => 0, 'objective' => 'Fotossíntese', 'points' => 10]]];
        Http::fake(fn () => Http::response(['choices' => [['finish_reason' => 'stop', 'message' => ['content' => json_encode($invalid)]]]]));
        try {
            app(AiService::class)->generate($exam->user_id, $exam->id);
            $this->fail('Alternativas repetidas nunca devem ser salvas.');
        } catch (\Illuminate\Validation\ValidationException $e) {
            $this->assertStringContainsString('alternativas repetidas', $e->getMessage());
        }
        Http::assertSentCount(2);
        $this->assertSame([], $exam->fresh()->content['questions']);
    }

    public function test_math_notation_survives_generation_review_and_storage(): void
    {
        config(['provaai.gemini_key' => 'test', 'provaai.groq_key' => null]);
        $exam = $this->exam();
        $exam->forceFill(['subject' => 'Matemática', 'topics' => 'Frações'])->save();
        $content = $this->content();
        $content['questions'][0]['statement'] = 'Calcule \\(\\frac{1}{2}+\\frac{1}{4}\\).';
        $content['questions'][0]['answer'] = '\\(\\frac{3}{4}\\)';
        $content['questions'][0]['objective'] = 'Somar frações';
        Http::fake(function ($request) use ($content) {
            $context = json_decode($request['contents'][0]['parts'][0]['text'], true);
            if (isset($context['questions'])) {
                $this->assertSame($content['questions'], $context['questions']);
                $result = ['aligned' => true, 'offTopicQuestions' => [], 'missingTopics' => []];
            } else {
                $this->assertStringContainsString('LaTeX', $request['systemInstruction']['parts'][0]['text']);
                $result = $content;
            }
            return Http::response(['candidates' => [['content' => ['parts' => [['text' => json_encode($result)]]]]]]);
        });
        app(AiService::class)->generate($exam->user_id, $exam->id);
        $this->assertSame($content['questions'], $exam->fresh()->content['questions']);
        $this->assertSame('verified', $exam->fresh()->content['mathReview']['results'][0]['status']);
        Http::assertSentCount(2);
    }

    public function test_math_objective_answer_is_resolved_before_review_for_collective_and_individual_exams(): void
    {
        config(['provaai.gemini_key' => 'test', 'provaai.groq_key' => null]);
        foreach (['regular', 'recovery'] as $purpose) {
            $exam = $this->exam();
            $exam->forceFill(['purpose' => $purpose, 'subject' => 'Matemática', 'topics' => 'Adição',
                'content' => ['instructions' => 'Responda.', 'objectiveCount' => 1, 'questions' => []]])->save();
            $raw = $this->content();
            $raw['questions'][0] = ['statement' => 'Calcule \\(2+3\\).', 'type' => 'objective',
                'options' => ['\\(4\\)', '\\(5\\)', '\\(6\\)', '\\(7\\)'],
                'answerIndex' => 1, 'objective' => 'Somar', 'points' => 10];
            Http::fake(function ($request) use ($raw) {
                $context = json_decode($request['contents'][0]['parts'][0]['text'], true);
                if (isset($context['questions'])) {
                    $this->assertSame('\\(5\\)', $context['questions'][0]['answer']);
                    $this->assertArrayNotHasKey('answerIndex', $context['questions'][0]);
                    $result = ['aligned' => true, 'offTopicQuestions' => [], 'missingTopics' => []];
                } else {
                    $this->assertSame(4, $request['generationConfig']['responseJsonSchema']['properties']['questions']['items']['properties']['options']['minItems']);
                    $result = $raw;
                }
                return Http::response(['candidates' => [['content' => ['parts' => [['text' => json_encode($result)]]]]]]);
            });
            $saved = app(AiService::class)->generate($exam->user_id, $exam->id);
            $this->assertSame('\\(5\\)', $saved->content['questions'][0]['answer']);
            $this->assertSame('verified', $saved->content['mathReview']['results'][0]['status']);
            Http::assertSentCount(2);
        }
    }

    public function test_gemini_generation_and_review_keep_private_fields_and_pdf_out_of_context(): void
    {
        config(['provaai.gemini_key' => 'test', 'provaai.groq_key' => 'reserve']);
        $e = $this->exam();
        $t = new ExamTemplate;
        $t->forceFill(['user_id' => $e->user_id, 'name' => 'Modelo', 'filename' => 'MODEL.PDF', 'path' => $e->user_id.'/a.pdf', 'reference_text' => 'OLD PRIVATE TEXT', 'extracted_text' => 'OLD QUESTIONS', 'processing_status' => 'ready'])->save();
        $e->template_id = $t->id;
        $e->save();
        Http::preventStrayRequests();
        Http::fake(function ($request) {
            $this->assertStringNotContainsString('PRIVATE', $request->body());
            $this->assertStringNotContainsString('OLD QUESTIONS', $request->body());
            $this->assertStringContainsString('googleapis.com', $request->url());
            $context = json_decode($request['contents'][0]['parts'][0]['text'], true);
            $content = isset($context['questions']) ? ['aligned' => true, 'offTopicQuestions' => [], 'missingTopics' => []] : $this->content();

            return Http::response(['candidates' => [['finishReason' => 'STOP', 'content' => ['parts' => [['text' => json_encode($content)]]]]]]);
        });
        $saved = app(AiService::class)->generate($e->user_id, $e->id);
        $this->assertCount(1, $saved->content['questions']);
        Http::assertSentCount(2);
    }

    public function test_groq_takes_over_failed_stage_without_regenerating_questions(): void
    {
        config(['provaai.gemini_key' => 'test', 'provaai.groq_key' => 'reserve']);
        $e = $this->exam();
        $generated = 0;
        $reviewed = 0;
        Http::fake(function ($r) use (&$generated, &$reviewed) {
            $groq = str_contains($r->url(), 'groq.com');
            $context = json_decode($groq ? $r['messages'][1]['content'] : $r['contents'][0]['parts'][0]['text'], true);
            if (! isset($context['questions'])) {
                $generated++;

                return Http::response(['candidates' => [['content' => ['parts' => [['text' => json_encode($this->content())]]]]]]);
            }
            if (! $groq) {
                return Http::response([], 503);
            }$reviewed++;
            $this->assertSame($this->content()['questions'], $context['questions']);

            return Http::response(['choices' => [['finish_reason' => 'stop', 'message' => ['content' => json_encode(['aligned' => true, 'offTopicQuestions' => [], 'missingTopics' => []])]]]]);
        });
        app(AiService::class)->generate($e->user_id, $e->id);
        $this->assertSame(1, $generated);
        $this->assertSame(1, $reviewed);
        Http::assertSentCount(3);
    }

    public function test_quick_gemini_outage_retries_only_the_failed_stage(): void
    {
        config(['provaai.gemini_key' => 'test', 'provaai.groq_key' => null]);
        $exam = $this->exam();
        $response = fn ($data) => ['candidates' => [['content' => ['parts' => [['text' => json_encode($data)]]]]]];
        Http::fakeSequence()->pushStatus(503)->push($response($this->content()))
            ->push($response(['aligned' => true, 'offTopicQuestions' => [], 'missingTopics' => []]));
        $saved = app(AiService::class)->generate($exam->user_id, $exam->id);
        $this->assertSame($this->content()['questions'], $saved->content['questions']);
        Http::assertSentCount(3);
    }

    public function test_quota_failure_leaves_a_retryable_draft_without_another_provider_call(): void
    {
        config(['provaai.gemini_key' => 'test', 'provaai.groq_key' => null]);
        $exam = $this->exam();
        Http::fakeSequence()->pushStatus(429);
        try {
            app(AiService::class)->generate($exam->user_id, $exam->id);
            $this->fail('Expected quota failure');
        } catch (\RuntimeException $e) {
            $this->assertStringContainsString('limite de uso', $e->getMessage());
        }
        $this->assertSame([], $exam->fresh()->content['questions']);
        Http::assertSentCount(1);
    }

    public function test_bad_review_leaves_draft_empty_and_retry_is_possible(): void
    {
        config(['provaai.gemini_key' => 'test']);
        $e = $this->exam();
        Http::fakeSequence()->push(['candidates' => [['content' => ['parts' => [['text' => json_encode($this->content())]]]]]])
            ->push(['candidates' => [['content' => ['parts' => [['text' => json_encode(['aligned' => false, 'offTopicQuestions' => [1], 'missingTopics' => []])]]]]]]);
        try {
            app(AiService::class)->generate($e->user_id, $e->id);
            $this->fail('Expected failure');
        } catch (\RuntimeException $ex) {
            $this->assertStringContainsString('conferência', $ex->getMessage());
        }
        $this->assertSame([], $e->fresh()->content['questions']);
    }

    public function test_batch_publishes_the_confirmed_generation_stage_until_the_exam_is_saved(): void
    {
        Queue::fake();
        config(['provaai.gemini_key' => 'test', 'provaai.groq_key' => null]);
        $exam = $this->exam();
        $service = app(BatchService::class);
        $id = $service->begin($exam->user_id, ['retry' => $exam->id]);
        $batch = ExamBatch::findOrFail($exam->user_id);
        $this->assertNull($batch->stage);

        Http::fake(function ($request) use ($batch) {
            $context = json_decode($request['contents'][0]['parts'][0]['text'], true);
            $reviewing = isset($context['questions']);
            $batch->refresh();
            $this->assertSame($reviewing ? 'reviewing' : 'generating', $batch->stage);
            $this->assertSame(0, $batch->completed);
            $result = $reviewing ? ['aligned' => true, 'offTopicQuestions' => [], 'missingTopics' => []] : $this->content();

            return Http::response(['candidates' => [['content' => ['parts' => [['text' => json_encode($result)]]]]]]);
        });
        (new GenerateBatchStep($exam->user_id, $id))->handle($service, app(AiService::class));
        $this->assertSame(1, $batch->refresh()->completed);
        $this->assertSame(0, $batch->failed);
        $this->assertNull($batch->stage);
        $this->assertCount(1, $exam->fresh()->content['questions']);
    }

    public function test_unwritable_log_does_not_interrupt_generation_or_leave_batch_running(): void
    {
        Queue::fake();
        config(['provaai.gemini_key' => 'test', 'provaai.groq_key' => 'reserve',
            'logging.default' => 'stack', 'logging.channels.stack.channels' => ['single'],
            'logging.channels.single.path' => storage_path('logs')]);
        app('log')->forgetChannel('single');
        app('log')->forgetChannel('stack');
        $exam = $this->exam();
        $service = app(BatchService::class);
        $id = $service->begin($exam->user_id, ['retry' => $exam->id]);
        // O caminho aponta a um diretório: Monolog não consegue abri-lo como arquivo.
        // Simula a falha Gemini para também exercitar o log da troca de provedor.
        Http::fake(function ($request) {
            if (!str_contains($request->url(), 'groq.com')) return Http::response([], 503);
            $context = json_decode($request['messages'][1]['content'], true);
            $result = isset($context['questions']) ? ['aligned' => true, 'offTopicQuestions' => [], 'missingTopics' => []] : $this->content();
            return Http::response(['choices' => [['finish_reason' => 'stop', 'message' => ['content' => json_encode($result)]]]]);
        });
        (new GenerateBatchStep($exam->user_id, $id))->handle($service, app(AiService::class));
        $batch = ExamBatch::findOrFail($exam->user_id);
        $this->assertSame(1, $batch->completed);
        $this->assertSame(0, $batch->failed);
        $this->assertNull($batch->lease_until);
        $this->assertCount(1, $exam->fresh()->content['questions']);
        Http::assertSentCount(3);
    }

    public function test_error_reporting_failure_cannot_leave_a_batch_stuck(): void
    {
        Queue::fake();
        $exam = $this->exam();
        $service = app(BatchService::class);
        $id = $service->begin($exam->user_id, ['retry' => $exam->id]);
        $ai = $this->mock(AiService::class);
        $ai->shouldReceive('generate')->once()->andThrow(new \RuntimeException('Falha transitória de teste'));
        $this->mock(\Illuminate\Contracts\Debug\ExceptionHandler::class)->shouldReceive('report')->once()
            ->andThrow(new \UnexpectedValueException('Destino de log indisponível'));
        (new GenerateBatchStep($exam->user_id, $id))->handle($service, $ai);
        $batch = ExamBatch::findOrFail($exam->user_id);
        $this->assertSame(1, $batch->completed);
        $this->assertSame(1, $batch->failed);
        $this->assertSame('Falha transitória de teste', $batch->last_error);
        $this->assertNull($batch->lease_until);
        $this->assertFalse($service->running($exam->user_id));
        $this->assertSame([], $exam->fresh()->content['questions']);
    }

    public function test_batch_lease_prevents_duplicate_work_and_old_worker_cannot_finish(): void
    {
        Queue::fake();
        $e = $this->exam();
        $b = new ExamBatch;
        $b->forceFill(['user_id' => $e->user_id, 'batch_id' => (string) Str::uuid(), 'title' => 'Batch', 'exam_ids' => [$e->id]])->save();
        $service = app(BatchService::class);
        $a = $service->claim($e->user_id, $b->batch_id);
        $this->assertNotNull($a);
        $this->assertNull($service->claim($e->user_id, $b->batch_id));
        $this->travel(151)->seconds();
        $next = $service->claim($e->user_id, $b->batch_id);
        $this->assertNotSame($a['lease'], $next['lease']);
        $service->setStage($e->user_id, $b->batch_id, $a['lease'], 'reviewing');
        $this->assertNull($b->fresh()->stage);
        $service->finish($e->user_id, $b->batch_id, $a['lease'], null);
        $this->assertSame(0, $b->fresh()->completed);
        $service->finish($e->user_id, $b->batch_id, $next['lease'], 'Limite de uso');
        $this->assertSame(1,$b->fresh()->failed);
    }
}
