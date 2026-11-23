<?php

namespace Tests\Feature;

use App\Models\{ClassRoom, Exam, Student, User};
use App\Services\{AiService, AiUsage, ExternalResearch};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\{DB, Http, Log};
use Tests\TestCase;

class TeacherDashboardTest extends TestCase
{
    use RefreshDatabase;

    private User $teacher;
    private ClassRoom $room;
    private Student $student;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo(\Carbon\Carbon::parse('2026-11-23 15:00:00', 'UTC'));
        Http::preventStrayRequests();
        config(['provaai.gemini_key' => 'fixture', 'provaai.groq_key' => null, 'provaai.provider' => 'gemini']);
        $this->teacher = User::factory()->create();
        $this->room = new ClassRoom;
        $this->room->forceFill(['user_id' => $this->teacher->id, 'name' => 'Ciências', 'subject' => 'Ciências', 'grade' => '7'])->save();
        $this->student = new Student;
        $this->student->forceFill(['user_id' => $this->teacher->id, 'class_id' => $this->room->id, 'name' => 'ALUNO PRIVADO', 'code' => 'A001'])->save();
    }

    private function content(): array
    {
        return ['instructions' => 'Responda.', 'questions' => [['type' => 'essay', 'statement' => 'Explique a fotossíntese.', 'options' => [], 'answer' => 'Produção de açúcares com luz.', 'objective' => 'Compreender', 'points' => 10]]];
    }

    private function exam(string $created, array $values = []): Exam
    {
        $exam = new Exam;
        $exam->forceFill(array_merge(['user_id' => $this->teacher->id, 'class_id' => $this->room->id, 'student_id' => $this->student->id,
            'title' => 'Plantas', 'subject' => 'Ciências', 'topics' => 'Fotossíntese', 'question_count' => 1, 'profile_snapshot' => [],
            'content' => $this->content(), 'created_at' => $created], $values))->save();
        return $exam;
    }

    private function dashboard(string $query = 'month=2026-11&period=month')
    {
        return $this->actingAs($this->teacher)->getJson('/api/teacher/dashboard?'.$query);
    }

    public function test_counts_real_exams_by_brasilia_day_and_never_exposes_other_teachers(): void
    {
        $this->exam('2026-11-01 02:59:59'); // Ainda outubro em Brasília.
        $this->exam('2026-11-01 03:00:00', ['status' => 'approved']);
        $this->exam('2026-12-01 02:59:59', ['purpose' => 'recovery']); // Último dia de novembro.
        $this->exam('2026-12-01 03:00:00');
        $this->exam('2026-11-10 12:00:00', ['content' => ['questions' => []]]);
        $other = User::factory()->create();
        $this->exam('2026-11-10 12:00:00', ['user_id' => $other->id]);
        $response = $this->dashboard('month=2026-11&period=month&user_id='.$other->id)->assertOk()->assertJsonPath('summary.exams', 2)
            ->assertJsonPath('summary.approved', 1)->assertJsonPath('summary.drafts', 1)->assertJsonPath('summary.empty_drafts', 1)
            ->assertJsonPath('summary.recovery', 1)->assertJsonPath('summary.questions', 2)->assertJsonPath('daily.0.exams', 1)
            ->assertJsonPath('daily.29.exams', 1)->assertJsonPath('classes.0.exams', 2)->assertJsonPath('active_students', 1);
        $this->assertStringNotContainsString('ALUNO PRIVADO', $response->getContent());
        $this->assertStringNotContainsString('fotossíntese', $response->getContent());
        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
        $this->room->update(['archived_at' => now()]);
        $this->dashboard()->assertJsonPath('active_students', 0)->assertJsonPath('active_classes', 0)->assertJsonPath('summary.exams', 2);
    }

    public function test_empty_data_periods_leap_year_and_invalid_filters(): void
    {
        $this->getJson('/api/teacher/dashboard?month=2026-11&period=month')->assertUnauthorized();
        $this->dashboard()->assertJsonPath('summary.exams', 0)->assertJsonPath('usage.measured_requests', 0)->assertJsonPath('usage.first_recorded_at', null);
        $this->dashboard('month=2024-02&period=month')->assertJsonCount(29, 'daily');
        $this->dashboard('month=2024-12&period=year')->assertJsonCount(366, 'daily');
        $this->dashboard('month=2026-01&period=quarter')->assertJsonPath('from', '2025-11-01');
        foreach (['month=2026-13&period=month', 'month=2027-01&period=month', 'month=1999-12&period=year', 'month=2026-11&period=anything', 'period=month'] as $query) $this->dashboard($query)->assertUnprocessable();
    }

    public function test_all_exams_count_beyond_the_workspace_list_limit(): void
    {
        $prototype = $this->exam('2026-11-12 12:00:00')->getAttributes();
        $rows = [];
        for ($i = 0; $i < 1000; $i++) $rows[] = array_merge($prototype, ['id' => (string) \Illuminate\Support\Str::uuid()]);
        foreach (array_chunk($rows, 100) as $chunk) DB::table('sala_exams')->insert($chunk);
        $this->dashboard()->assertJsonPath('summary.exams', 1001)->assertJsonPath('daily.11.exams', 1001);
    }

    public function test_usage_is_actual_provider_total_including_thoughts_not_double_counted_cache(): void
    {
        Http::fakeSequence()->push(['usageMetadata' => ['promptTokenCount' => 100, 'candidatesTokenCount' => 30, 'thoughtsTokenCount' => 20, 'cachedContentTokenCount' => 40, 'totalTokenCount' => 150]])
            ->push(['usage' => ['prompt_tokens' => 20, 'completion_tokens' => 10, 'total_tokens' => 30]])->push([])->push(['usage' => ['total_tokens' => 0]])
            ->push(['usage' => ['total_tokens' => 9999]]);
        $meter = app(AiUsage::class);
        foreach (['gemini', 'groq', 'mistral', 'mistral'] as $provider) $meter->request($this->teacher->id, $provider, 'fixture', 'generation', fn () => Http::post('https://example.test'));
        $other = User::factory()->create();
        $meter->request($other->id, 'groq', 'fixture', 'review', fn () => Http::post('https://example.test'));
        $this->dashboard()->assertJsonPath('usage.total_tokens', 180)->assertJsonPath('usage.input_tokens', 120)->assertJsonPath('usage.output_tokens', 40)
            ->assertJsonPath('usage.requests', 4)->assertJsonPath('usage.measured_requests', 3)->assertJsonPath('usage.unmeasured_requests', 1)
            ->assertJsonPath('usage.input_measured_requests', 2)->assertJsonPath('usage.output_measured_requests', 2)
            ->assertJsonPath('usage.stages.generation', 180)->assertJsonPath('daily.22.tokens', 180);
    }

    public function test_timeout_remains_unknown_and_telemetry_failure_cannot_break_generation(): void
    {
        try { app(AiUsage::class)->request($this->teacher->id, 'gemini', 'fixture', 'review', fn () => throw new ConnectionException('timeout')); $this->fail('Deve manter falha de conexão.'); }
        catch (ConnectionException) { $this->assertDatabaseHas('ai_usage_events', ['user_id' => $this->teacher->id, 'total_tokens' => null, 'http_status' => null]); }
        $this->dashboard()->assertJsonPath('usage.http_failures', 1)->assertJsonPath('usage.unmeasured_requests', 1);
        Log::spy();
        Http::fake(['*' => Http::response(['ok' => true])]);
        $response = app(AiUsage::class)->request((string) \Illuminate\Support\Str::uuid(), 'gemini', 'fixture', 'generation', fn () => Http::post('https://example.test'));
        $this->assertTrue($response->successful());
        Log::shouldHaveReceived('warning')->with('ai_usage_record_failed', ['provider' => 'gemini', 'stage' => 'generation'])->once();
    }

    public function test_generation_fallback_and_review_each_record_once_and_existing_exam_does_not_spend_again(): void
    {
        config(['provaai.groq_key' => 'fallback']);
        $exam = $this->exam('2026-11-23 12:00:00', ['content' => ['questions' => [], 'objectiveCount' => 0]]);
        Http::fake(function ($r) {
            if (str_contains($r->url(), 'googleapis')) return Http::response([], 503);
            $context = json_decode($r['messages'][1]['content'], true);
            $result = isset($context['questions']) ? ['aligned' => true, 'offTopicQuestions' => [], 'missingTopics' => []] : $this->content();
            return Http::response(['usage' => ['prompt_tokens' => 100, 'completion_tokens' => 50, 'total_tokens' => 150], 'choices' => [['finish_reason' => 'stop', 'message' => ['content' => json_encode($result)]]]]);
        });
        app(AiService::class)->generate($this->teacher->id, $exam->id);
        app(AiService::class)->generate($this->teacher->id, $exam->id);
        $this->assertDatabaseCount('ai_usage_events', 3);
        $this->dashboard()->assertJsonPath('usage.total_tokens', 300)->assertJsonPath('usage.stages.review', 150)->assertJsonPath('usage.http_failures', 1);
        Http::assertSentCount(3);
    }

    public function test_invalid_model_output_still_records_usage_and_cached_research_does_not_repeat_usage(): void
    {
        Http::fakeSequence()->push(['usageMetadata' => ['totalTokenCount' => 77], 'candidates' => [['content' => ['parts' => [['text' => 'JSON inválido']]]]]])
            ->push(['usageMetadata' => ['totalTokenCount' => 33], 'candidates' => [['finishReason' => 'STOP', 'content' => ['parts' => [['text' => 'Resumo de ciências.']]], 'groundingMetadata' => ['groundingChunks' => [['web' => ['uri' => 'https://example.org', 'title' => 'Fonte']]]]]]]);
        $exam = $this->exam('2026-11-23 12:00:00', ['content' => ['questions' => [], 'objectiveCount' => 0]]);
        try { app(AiService::class)->generate($this->teacher->id, $exam->id); $this->fail('JSON deve falhar.'); }
        catch (\RuntimeException $e) { $this->assertStringContainsString('inválido', $e->getMessage()); }
        for ($i = 0; $i < 2; $i++) app(ExternalResearch::class)->find($this->teacher->id, $this->room->id, 'Ciências', 'Plantas');
        $this->assertDatabaseCount('ai_usage_events', 2);
        $this->dashboard()->assertJsonPath('usage.total_tokens', 110)->assertJsonPath('usage.stages.research', 33)->assertJsonPath('summary.exams', 0);
        Http::assertSentCount(2);
    }

    public function test_usage_migration_can_be_reversed_without_touching_existing_exams(): void
    {
        $exam = $this->exam('2026-11-23 12:00:00');
        $migration = require database_path('migrations/2026_11_23_180000_create_ai_usage_events.php');
        $migration->down();
        $this->assertFalse(\Illuminate\Support\Facades\Schema::hasTable('ai_usage_events'));
        $this->assertDatabaseHas('sala_exams', ['id' => $exam->id]);
        $migration->up();
        $this->assertTrue(\Illuminate\Support\Facades\Schema::hasTable('ai_usage_events'));
        $this->dashboard()->assertOk()->assertJsonPath('summary.exams', 1)->assertJsonPath('usage.requests', 0);
    }
}
