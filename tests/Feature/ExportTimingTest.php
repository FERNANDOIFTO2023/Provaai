<?php

namespace Tests\Feature;

use App\Models\ClassRoom;
use App\Models\Exam;
use App\Models\Student;
use App\Models\User;
use App\Services\DocumentService;
use App\Services\ExportArtifacts;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Mockery;
use Tests\TestCase;

/** Testa o diagnóstico com atrasos controlados, sem depender da velocidade da máquina. */
class ExportTimingTest extends TestCase
{
    use RefreshDatabase;

    private function exam(): Exam
    {
        Storage::fake('local');
        $user = User::factory()->create();
        $this->actingAs($user);
        $room = new ClassRoom;
        $room->forceFill(['user_id' => $user->id, 'name' => 'Turma privada', 'subject' => 'Ciências', 'grade' => '7'])->save();
        $student = new Student;
        $student->forceFill(['user_id' => $user->id, 'class_id' => $room->id, 'name' => 'Aluno privado', 'code' => 'P001'])->save();
        $exam = new Exam;
        $exam->forceFill([
            'user_id' => $user->id, 'class_id' => $room->id, 'student_id' => $student->id,
            'title' => 'Título privado', 'subject' => 'Ciências', 'topics' => 'Plantas',
            'question_count' => 1, 'status' => 'approved',
            'profile_snapshot' => ['name' => $student->name, 'code' => $student->code],
            'content' => ['instructions' => 'Conteúdo privado', 'questions' => []],
        ])->save();

        return $exam;
    }

    /** Lê o contrato público de Server-Timing em vez de inspecionar o estado do serviço. */
    private function durations($response): array
    {
        preg_match_all('/(?:^|, )([a-z_]+);dur=([0-9.]+)/', $response->headers->get('Server-Timing', ''), $matches, PREG_SET_ORDER);
        $values = [];
        foreach ($matches as $match) {
            $values[$match[1]] = (float) $match[2];
        }

        return $values;
    }

    public function test_separates_conversion_from_lock_wait_and_reports_cache_without_private_data(): void
    {
        $exam = $this->exam();
        Log::spy();
        // A simulação entrega bytes reconhecíveis; a conversão real continua coberta em DocumentsTest.
        $this->partialMock(DocumentService::class)->shouldReceive('run')->twice()->andReturnUsing(function ($input) {
            usleep(30_000);
            file_put_contents($input['outputPath'], $input['operation'] === 'convert' ? '%PDF-simulado' : 'PK-simulado');

            return ['ok' => true];
        });
        $progress = (string) Str::uuid();
        $response = $this->postJson('/api/export/exam', ['id' => $exam->id, 'format' => 'pdf', 'progressId' => $progress])->assertOk();
        $times = $this->durations($response);
        $this->assertGreaterThanOrEqual(30, $times['docx_render']);
        $this->assertGreaterThanOrEqual(30, $times['pdf_convert']);
        $this->assertGreaterThanOrEqual($times['docx_render'] + $times['pdf_convert'], $times['app_total'] + .02);
        $this->assertLessThan($times['docx_render'] + $times['pdf_convert'], $times['pdf_lock_wait']);
        $this->assertArrayHasKey('progress', $times);
        $this->assertNull(Cache::get('download:'.$exam->user_id.':'.$progress));
        $response->assertContent('%PDF-simulado')->assertHeader('Cache-Control', 'no-store, private');
        $this->assertStringContainsString('pdf_cache;desc="miss"', $response->headers->get('Server-Timing'));
        $id = $response->headers->get('X-Export-Id');
        $this->assertTrue(Str::isUuid($id));
        Log::shouldHaveReceived('info')->with('document_export_timing', Mockery::on(function ($context) use ($id, $times) {
            // Lista fechada: evita que nomes, questões, IDs de alunos ou cookies entrem no log.
            return array_keys($context) === ['export_id', 'status', 'duration_ms', 'cache']
                && $context['export_id'] === $id && $context['status'] === 200
                && $context['duration_ms'] === $times
                && $context['cache'] === ['pdf' => 'miss', 'docx' => 'miss'];
        }))->once();

        $cached = $this->postJson('/api/export/exam', ['id' => $exam->id, 'format' => 'pdf'])->assertOk()->assertContent('%PDF-simulado');
        $this->assertStringContainsString('pdf_cache;desc="hit"', $cached->headers->get('Server-Timing'));
        $this->assertArrayNotHasKey('pdf_convert', $this->durations($cached));
        $this->assertArrayNotHasKey('docx_render', $this->durations($cached));
        $this->assertNotSame($id, $cached->headers->get('X-Export-Id'));
    }

    public function test_measures_waiting_for_another_export_and_reuses_its_result(): void
    {
        $exam = $this->exam();
        $lock = Mockery::mock(\Illuminate\Contracts\Cache\Lock::class);
        $lock->shouldReceive('block')->once()->with(125)->andReturnUsing(function () {
            usleep(30_000);
            return true;
        });
        $lock->shouldReceive('release')->once()->andReturn(true);
        Cache::partialMock()->shouldReceive('lock')->once()->with(Mockery::type('string'), 300)->andReturn($lock);
        $this->mock(ExportArtifacts::class)->shouldReceive('get')->with(Mockery::pattern('/^export:v6:[0-9a-f]{64}:docx$/'))->twice()->andReturn(null, 'PK-reutilizado');
        $this->partialMock(DocumentService::class)->shouldNotReceive('run');

        $response = $this->postJson('/api/export/exam', ['id' => $exam->id, 'format' => 'docx'])->assertOk()->assertContent('PK-reutilizado');
        $this->assertGreaterThanOrEqual(30, $this->durations($response)['docx_lock_wait']);
        $this->assertArrayNotHasKey('docx_render', $this->durations($response));
        $this->assertStringContainsString('docx_cache;desc="hit_after_wait"', $response->headers->get('Server-Timing'));
    }

    public function test_conversion_failure_retains_timing_releases_locks_and_allows_retry(): void
    {
        $exam = $this->exam();
        $attempt = 0;
        $this->partialMock(DocumentService::class)->shouldReceive('run')->twice()->andReturnUsing(function ($input) use (&$attempt) {
            if (++$attempt === 1) {
                usleep(30_000);
                throw new \RuntimeException('Falha de teste.');
            }
            file_put_contents($input['outputPath'], 'PK-recuperado');
            return ['ok' => true];
        });
        $progress = (string) Str::uuid();
        $failed = $this->postJson('/api/export/exam', ['id' => $exam->id, 'format' => 'docx', 'progressId' => $progress])->assertUnprocessable();
        $this->assertGreaterThanOrEqual(30, $this->durations($failed)['docx_render']);
        $this->assertArrayHasKey('docx_lock_release', $this->durations($failed));
        $this->assertNull(Cache::get('download:'.$exam->user_id.':'.$progress));
        // Comprova a liberação de verdade, sem esperar os 125 segundos de timeout em uma regressão.
        $key = 'export:v6:'.hash('sha256', json_encode([$exam->fresh()->except(['updated_at', 'created_at']), auth()->user()->name, 'Turma privada', false, null, null, null]));
        $lock = Cache::lock($key.':docx:lock', 300);
        $this->assertTrue($lock->get());
        $lock->release();
        $this->postJson('/api/export/exam', ['id' => $exam->id, 'format' => 'docx'])->assertOk()->assertContent('PK-recuperado');
    }

    public function test_unacquired_lock_is_not_released_and_timeout_remains_observable(): void
    {
        $exam = $this->exam();
        $lock = Mockery::mock(\Illuminate\Contracts\Cache\Lock::class);
        $lock->shouldReceive('block')->once()->with(125)->andThrow(new \Illuminate\Contracts\Cache\LockTimeoutException);
        $lock->shouldNotReceive('release');
        Cache::partialMock()->shouldReceive('lock')->once()->andReturn($lock);
        $this->partialMock(DocumentService::class)->shouldNotReceive('run');
        $response = $this->postJson('/api/export/exam', ['id' => $exam->id, 'format' => 'docx']);
        $this->assertGreaterThanOrEqual(400, $response->status());
        $this->assertArrayHasKey('docx_lock_wait', $this->durations($response));
    }

    public function test_other_routes_anonymous_requests_and_foreign_exams_remain_protected(): void
    {
        $this->postJson('/api/export/exam', ['id' => (string) Str::uuid(), 'format' => 'pdf'])->assertUnauthorized()->assertHeaderMissing('Server-Timing');
        $exam = $this->exam();
        $this->actingAs(User::factory()->create());
        $this->partialMock(DocumentService::class)->shouldNotReceive('run');
        $this->postJson('/api/export/exam', ['id' => $exam->id, 'format' => 'pdf'])->assertNotFound();
        $this->getJson('/api/config')->assertOk()->assertHeaderMissing('Server-Timing')->assertHeaderMissing('X-Export-Id');
    }

    public function test_broken_log_destination_does_not_break_download(): void
    {
        $exam = $this->exam();
        Log::shouldReceive('info')->once()->andThrow(new \RuntimeException('Destino indisponível.'));
        $this->partialMock(DocumentService::class)->shouldReceive('run')->once()->andReturnUsing(function ($input) {
            file_put_contents($input['outputPath'], 'PK-pronto');
            return ['ok' => true];
        });
        $response = $this->postJson('/api/export/exam', ['id' => $exam->id, 'format' => 'docx'])->assertOk()->assertContent('PK-pronto');
        $this->assertArrayHasKey('docx_render', $this->durations($response));
    }
}
