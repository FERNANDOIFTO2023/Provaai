<?php

namespace Tests\Feature;

use App\Models\{ClassMaterial, ClassRoom, Exam, Student, User};
use App\Services\{AiService, ClassSources, DocumentService, ExternalResearch};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\{DB, Http, Queue, Storage};
use Tests\TestCase;

class ClassMaterialsTest extends TestCase
{
    use RefreshDatabase;
    private User $user;
    private ClassRoom $room;
    private Student $student;
    private string $text = 'A fotossíntese usa luz, água e gás carbônico para produzir açúcares nas plantas.';

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local'); Queue::fake(); Http::preventStrayRequests();
        config(['provaai.gemini_key' => 'test', 'provaai.groq_key' => null, 'provaai.provider' => 'gemini']);
        $this->user = User::factory()->create(); $this->actingAs($this->user);
        $this->room = new ClassRoom;
        $this->room->forceFill(['user_id' => $this->user->id, 'name' => 'Ciências', 'grade' => '7', 'subject' => 'Ciências'])->save();
        $this->student = new Student;
        $this->student->forceFill(['user_id' => $this->user->id, 'class_id' => $this->room->id, 'name' => 'Aluno privado', 'code' => 'A001'])->save();
    }

    private function url(): string { return '/api/classes/'.$this->room->id.'/materials'; }

    private function material(): ClassMaterial
    {
        $m = new ClassMaterial;
        $m->forceFill(['user_id' => $this->user->id, 'class_id' => $this->room->id, 'filename' => 'aula.pdf',
            'path' => 'class-materials/'.$this->user->id.'/'.\Illuminate\Support\Str::uuid().'.pdf', 'size' => 100, 'extracted_text' => $this->text])->save();
        Storage::disk('local')->put($m->getRawOriginal('path'), 'private');
        return $m;
    }

    private function exam(): Exam
    {
        $e = new Exam;
        $e->forceFill(['user_id' => $this->user->id, 'class_id' => $this->room->id, 'student_id' => $this->student->id,
            'title' => 'Plantas', 'subject' => 'Ciências', 'topics' => 'Fotossíntese', 'question_count' => 1,
            'content' => ['instructions' => '', 'questions' => [], 'objectiveCount' => 0], 'profile_snapshot' => [],
            'source_snapshot' => app(ClassSources::class)->snapshot($this->user->id, $this->room->id)])->save();
        return $e;
    }

    private function content(): array
    {
        return ['instructions' => 'Responda.', 'questions' => [['type' => 'essay', 'statement' => 'Explique como as plantas produzem açúcares.',
            'options' => [], 'answer' => 'Por fotossíntese usando luz, água e gás carbônico.', 'objective' => 'Compreender a fotossíntese.', 'points' => 10]]];
    }

    public function test_real_pdf_and_word_are_read_once_and_owned_materials_are_private(): void
    {
        foreach (['pdf', 'docx'] as $ext) {
            $file = new UploadedFile(base_path('tests/fixtures/'.($ext === 'pdf' ? 'class-material.pdf' : 'model.docx')), 'aula.'.$ext, null, null, true);
            $this->postJson($this->url(), ['file' => $file])->assertCreated()->assertJsonMissingPath('material.path');
        }
        $this->getJson($this->url())->assertOk()->assertJsonCount(2, 'materials')->assertJsonPath('allow_external_sources', false);
        $m = ClassMaterial::first();
        $this->get($this->url().'/'.$m->id)->assertOk();
        $this->actingAs(User::factory()->create());
        $this->getJson($this->url())->assertNotFound();
        $this->getJson($this->url().'/'.$m->id)->assertNotFound();
        $this->deleteJson($this->url().'/'.$m->id)->assertNotFound();
        $this->patchJson($this->url(), ['allow_external_sources' => true])->assertNotFound();
        $this->postJson($this->url(), ['file' => UploadedFile::fake()->create('a.pdf')])->assertNotFound();
        $this->assertDatabaseCount('sala_class_materials', 2);
    }

    public function test_invalid_upload_is_cleaned_and_archive_cannot_change_sources(): void
    {
        $this->mock(DocumentService::class)->shouldReceive('run')->once()->andThrow(new \RuntimeException('bad file'));
        $this->postJson($this->url(), ['file' => UploadedFile::fake()->create('a.ppt')])->assertUnprocessable();
        $this->assertSame([], Storage::disk('local')->allFiles());
        $this->postJson($this->url(), ['file' => UploadedFile::fake()->create('a.exe')])->assertUnprocessable();
        $this->room->update(['archived_at' => now()]);
        $this->patchJson($this->url(), ['allow_external_sources' => true])->assertConflict();
        $this->postJson($this->url(), ['file' => UploadedFile::fake()->create('a.pdf')])->assertConflict();
    }

    public function test_strict_generation_keeps_snapshot_does_not_search_or_reextract_and_reviews_sources(): void
    {
        $m = $this->material(); $exam = $this->exam();
        $m->update(['extracted_text' => 'Alteração posterior não pode trocar a referência do lote.']);
        $this->room->update(['allow_external_sources' => true]);
        $this->mock(DocumentService::class)->shouldNotReceive('run');
        $this->mock(ExternalResearch::class)->shouldNotReceive('find');
        Http::fake(function ($request) {
            $context = json_decode($request['contents'][0]['parts'][0]['text'], true);
            $this->assertSame($this->text, $context['sources']['materials'][0]['text']);
            $this->assertFalse($context['sources']['allow_external']);
            $this->assertArrayNotHasKey('tools', $request->data());
            $result = isset($context['questions']) ? ['aligned' => true, 'offTopicQuestions' => [], 'missingTopics' => [], 'sourcesGrounded' => true, 'offSourceQuestions' => []] : $this->content();
            return Http::response(['candidates' => [['content' => ['parts' => [['text' => json_encode($result)]]]]]]);
        });
        app(AiService::class)->generate($exam->user_id, $exam->id);
        $this->assertCount(1, $exam->fresh()->content['questions']);
        $this->assertNull($exam->fresh()->external_research);
        Http::assertSentCount(2);
    }

    public function test_missing_or_negative_source_review_preserves_empty_draft(): void
    {
        $this->material();
        $sequence = Http::fakeSequence();
        foreach ([[], ['sourcesGrounded' => false, 'offSourceQuestions' => [1]]] as $extra) {
            $sequence->push(['candidates' => [['content' => ['parts' => [['text' => json_encode($this->content())]]]]]])
                ->push(['candidates' => [['content' => ['parts' => [['text' => json_encode(['aligned' => true, 'offTopicQuestions' => [], 'missingTopics' => [], ...$extra])]]]]]]);
        }
        foreach ([[], ['sourcesGrounded' => false, 'offSourceQuestions' => [1]]] as $extra) {
            $exam = $this->exam();
            try { app(AiService::class)->generate($exam->user_id, $exam->id); $this->fail('Não deve aceitar conteúdo sem apoio.'); }
            catch (\RuntimeException $e) { $this->assertStringContainsString('apoio nos anexos', $e->getMessage()); }
            $this->assertSame([], $exam->fresh()->content['questions']);
        }
    }

    public function test_external_research_uses_tool_and_caches_sources_not_questions(): void
    {
        $this->material();
        $this->patchJson($this->url(), ['allow_external_sources' => true])->assertOk();
        $exam = $this->exam();
        Http::fake(function ($request) {
            if (isset($request['tools'])) {
                $this->assertArrayHasKey('google_search', $request['tools'][0]);
                $this->assertStringNotContainsString('Aluno privado', $request->body());
                $this->assertStringNotContainsString($this->text, $request->body());
                return Http::response(['candidates' => [['finishReason' => 'STOP', 'content' => ['parts' => [['text' => 'Pesquisa externa sobre fotossíntese.']]],
                    'groundingMetadata' => ['groundingChunks' => [['web' => ['uri' => 'https://example.org/aula', 'title' => 'Fonte']]]]]]]);
            }
            $context = json_decode($request['contents'][0]['parts'][0]['text'], true);
            $this->assertTrue($context['sources']['allow_external']);
            $this->assertSame('Pesquisa externa sobre fotossíntese.', $context['external_research']);
            $result = isset($context['questions']) ? ['aligned' => true, 'offTopicQuestions' => [], 'missingTopics' => []] : $this->content();
            return Http::response(['candidates' => [['content' => ['parts' => [['text' => json_encode($result)]]]]]]);
        });
        app(AiService::class)->generate($exam->user_id, $exam->id);
        $this->assertSame('https://example.org/aula', $exam->fresh()->external_research['sources'][0]['url']);
        app(ExternalResearch::class)->find($exam->user_id, $exam->class_id, $exam->subject, $exam->topics);
        Http::assertSentCount(3);
    }

    public function test_external_research_recovers_from_503_and_records_each_attempt_once(): void
    {
        Http::fakeSequence()->pushStatus(503)->push(['candidates' => [['finishReason' => 'STOP',
            'content' => ['parts' => [['text' => 'Conceitos sobre fotossíntese.']]],
            'groundingMetadata' => ['groundingChunks' => [['web' => ['uri' => 'https://example.org/aula', 'title' => 'Fonte']]]]]]]);
        $research = app(ExternalResearch::class);
        $first = $research->find($this->user->id, $this->room->id, 'Ciências', 'Fotossíntese');
        $second = $research->find($this->user->id, $this->room->id, 'Ciências', 'Fotossíntese');
        $this->assertSame($first, $second);
        $this->assertSame('https://example.org/aula', $first['sources'][0]['url']);
        Http::assertSentCount(2);
        $this->assertSame([503, 200], DB::table('ai_usage_events')->orderBy('created_at')->pluck('http_status')->all());
    }

    public function test_batch_and_manual_drafts_take_server_snapshot_and_ignore_forged_sources(): void
    {
        $this->material();
        $values = ['class_id' => $this->room->id, 'student_id' => $this->student->id, 'title' => 'Plantas', 'subject' => 'Ciências',
            'topics' => 'Fotossíntese', 'question_count' => 1, 'content' => ['instructions' => '', 'questions' => []], 'source_snapshot' => ['allow_external' => true]];
        $id = $this->postJson('/api/data/sala_exams', ['op' => 'insert', 'single' => 'single', 'values' => $values])->assertOk()->assertJsonMissingPath('data.source_snapshot')->json('data.id');
        $this->assertFalse(Exam::findOrFail($id)->source_snapshot['allow_external']);
        $this->postJson('/api/actions/sala_begin_exam_batch', ['p_input' => ['classId' => $this->room->id, 'students' => [$this->student->id],
            'title' => 'Lote', 'subject' => 'Ciências', 'topics' => 'Fotossíntese', 'count' => 1, 'objectiveCount' => 0, 'choice' => 'builtin']])->assertOk();
        $this->assertSame($this->text, Exam::where('title', 'Lote')->sole()->source_snapshot['materials'][0]['text']);
    }

    public function test_limits_cannot_publish_partial_material_and_cleanup_removes_original(): void
    {
        for ($i = 0; $i < 5; $i++) $this->material();
        $this->mock(DocumentService::class)->shouldReceive('run')->once()->andReturn(['text' => $this->text]);
        $this->postJson($this->url(), ['file' => UploadedFile::fake()->create('extra.pdf')])->assertUnprocessable();
        $this->assertDatabaseCount('sala_class_materials', 5);
        $this->assertCount(5, Storage::disk('local')->allFiles());
        $material = ClassMaterial::first();
        $this->deleteJson($this->url().'/'.$material->id)->assertNoContent();
        $this->assertDatabaseCount('sala_class_materials', 4);
        // Confirma a transação de teste para executar a limpeza após o commit do banco, sem operação Git.
        DB::commit();
        Storage::disk('local')->assertMissing($material->getRawOriginal('path'));
        DB::beginTransaction();
        $this->postJson('/api/actions/sala_delete_class', ['p_class' => $this->room->id, 'p_reason' => 'Limpeza de teste'])->assertOk();
        DB::commit();
        $this->assertSame([], Storage::disk('local')->allFiles());
        $this->assertDatabaseCount('sala_class_materials', 0);
        $this->user->delete();
        DB::beginTransaction();
    }

    public function test_external_failure_does_not_generate_without_research_or_disclose_sources(): void
    {
        $this->material(); $this->room->update(['allow_external_sources' => true]); $exam = $this->exam();
        Http::fake(['*' => Http::response(['candidates' => [['finishReason' => 'STOP', 'content' => ['parts' => [['text' => 'Sem fontes.']]]]]])]);
        try { app(AiService::class)->generate($exam->user_id, $exam->id); $this->fail('A pesquisa deve falhar.'); }
        catch (\RuntimeException $e) { $this->assertStringContainsString('fontes verificáveis', $e->getMessage()); }
        $this->assertSame([], $exam->fresh()->content['questions']);
        Http::assertSentCount(1);
        config(['provaai.gemini_key' => null]);
        $this->patchJson($this->url(), ['allow_external_sources' => true])->assertUnprocessable();
        $this->patchJson($this->url(), ['allow_external_sources' => false])->assertOk();
    }

    public function test_batch_prepares_references_once_and_never_runs_converter_for_each_student(): void
    {
        $this->material()->update(['extracted_text' => str_repeat('Conteúdo da aula. ', 3000)]);
        $ids = [$this->student->id];
        for ($i = 2; $i <= 30; $i++) {
            $student = new Student;
            $student->forceFill(['user_id' => $this->user->id, 'class_id' => $this->room->id, 'name' => 'Aluno '.$i, 'code' => 'A'.$i])->save();
            $ids[] = $student->id;
        }
        $this->mock(DocumentService::class)->shouldNotReceive('run');
        DB::enableQueryLog();
        $start = microtime(true);
        $this->postJson('/api/actions/sala_begin_exam_batch', ['p_input' => ['classId' => $this->room->id, 'students' => $ids,
            'title' => 'Lote rápido', 'subject' => 'Ciências', 'topics' => 'Fotossíntese', 'count' => 1, 'objectiveCount' => 0, 'choice' => 'builtin']])->assertOk();
        $ms = round((microtime(true) - $start) * 1000, 1);
        $reads = collect(DB::getQueryLog())->filter(fn ($q) => str_starts_with($q['query'], 'select') && str_contains($q['query'], 'sala_class_materials'))->count();
        DB::disableQueryLog();
        $this->assertSame(1, $reads);
        $this->assertDatabaseCount('sala_exams', 30);
        fwrite(STDOUT, "\nPreparação local de 30 rascunhos: {$ms} ms; 1 consulta às referências, 0 conversões, IA não executada.\n");
    }

    public function test_fallback_keeps_material_restriction_and_rejects_repeated_questions(): void
    {
        $this->material();
        config(['provaai.groq_key' => 'reserve']);
        Http::fake(function ($request) {
            if (!str_contains($request->url(), 'groq.com')) return Http::response([], 503);
            $context = json_decode($request['messages'][1]['content'], true);
            $this->assertFalse($context['sources']['allow_external']);
            $this->assertSame($this->text, $context['sources']['materials'][0]['text']);
            $result = isset($context['questions']) ? ['aligned' => true, 'offTopicQuestions' => [], 'missingTopics' => [], 'sourcesGrounded' => true, 'offSourceQuestions' => []] : $this->content();
            return Http::response(['choices' => [['finish_reason' => 'stop', 'message' => ['content' => json_encode($result)]]]]);
        });
        $first = $this->exam();
        app(AiService::class)->generate($this->user->id, $first->id);
        $this->assertCount(1, $first->fresh()->content['questions']);
        $second = $this->exam();
        try { app(AiService::class)->generate($this->user->id, $second->id); $this->fail('A questão repetida deve ser bloqueada.'); }
        catch (\Illuminate\Validation\ValidationException $e) { $this->assertStringContainsString('repetidas', $e->getMessage()); }
        $this->assertSame([], $second->fresh()->content['questions']);
    }

    public function test_repeated_review_outage_recovers_without_regenerating_or_losing_material_restriction(): void
    {
        $this->material();
        $exam = $this->exam();
        $generated = 0;
        $reviewed = 0;
        Http::fake(function ($request) use (&$generated, &$reviewed) {
            $context = json_decode($request['contents'][0]['parts'][0]['text'], true);
            $this->assertFalse($context['sources']['allow_external']);
            $this->assertSame($this->text, $context['sources']['materials'][0]['text']);
            if (isset($context['questions'])) {
                $this->assertSame($this->content()['questions'], $context['questions']);
                if (++$reviewed < 3) return Http::response([], 503);
                $result = ['aligned' => true, 'offTopicQuestions' => [], 'missingTopics' => [], 'sourcesGrounded' => true, 'offSourceQuestions' => []];
            } else {
                $generated++;
                $result = $this->content();
            }
            return Http::response(['candidates' => [['finishReason' => 'STOP', 'content' => ['parts' => [['text' => json_encode($result)]]]]]]);
        });
        app(AiService::class)->generate($this->user->id, $exam->id);
        $this->assertSame(1, $generated);
        $this->assertSame(3, $reviewed);
        $this->assertSame($this->content()['questions'], $exam->fresh()->content['questions']);
        Http::assertSentCount(4);
    }

    public function test_total_text_limit_does_not_truncate_or_replace_existing_materials(): void
    {
        $this->material()->update(['extracted_text' => str_repeat('a', 59990)]);
        $this->mock(DocumentService::class)->shouldReceive('run')->once()->andReturn(['text' => $this->text]);
        $this->postJson($this->url(), ['file' => UploadedFile::fake()->create('outra-aula.docx')])->assertUnprocessable();
        $this->assertSame(59990, mb_strlen(ClassMaterial::sole()->extracted_text));
        $this->assertCount(1, Storage::disk('local')->allFiles());
    }
}
