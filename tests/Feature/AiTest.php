<?php

namespace Tests\Feature;

use App\Models\ClassRoom;
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
        $service->finish($e->user_id, $b->batch_id, $a['lease'], null);
        $this->assertSame(0, $b->fresh()->completed);
        $service->finish($e->user_id, $b->batch_id, $next['lease'], 'Limite de uso');
        $this->assertSame(1,$b->fresh()->failed);
    }
}
