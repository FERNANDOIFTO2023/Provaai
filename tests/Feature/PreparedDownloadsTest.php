<?php

namespace Tests\Feature;

use App\Jobs\PrepareExamDownload;
use App\Models\ClassRoom;
use App\Models\Exam;
use App\Models\ExamTemplate;
use App\Models\Student;
use App\Models\User;
use App\Services\DocumentService;
use App\Services\ExportArtifacts;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/** Regressões do caminho rápido: aprovação, fila, arquivos privados e troca de versão. */
class PreparedDownloadsTest extends TestCase
{
    use RefreshDatabase;

    private function exam(string $status = 'approved'): Exam
    {
        Storage::fake('local');
        $user = User::factory()->create();
        $this->actingAs($user);
        $room = new ClassRoom;
        $room->forceFill(['user_id' => $user->id, 'name' => '7º A', 'subject' => 'Ciências', 'grade' => '7'])->save();
        $student = new Student;
        $student->forceFill(['user_id' => $user->id, 'class_id' => $room->id, 'name' => 'Aluno fictício', 'code' => 'A001'])->save();
        $exam = new Exam;
        $exam->forceFill([
            'user_id' => $user->id, 'class_id' => $room->id, 'student_id' => $student->id,
            'title' => 'Plantas', 'subject' => 'Ciências', 'topics' => 'Fotossíntese',
            'question_count' => 1, 'status' => $status,
            'profile_snapshot' => ['name' => $student->name, 'code' => $student->code],
            'content' => ['instructions' => 'Responda.', 'questions' => [[
                'type' => 'essay', 'statement' => 'Explique a fotossíntese.', 'options' => [],
                'answer' => 'RESPOSTA RESERVADA', 'objective' => 'Compreender plantas', 'points' => 10,
            ]]],
        ])->save();

        return $exam->fresh();
    }

    /** Conversor determinístico para conferir invalidação sem medir a máquina nem chamar IA. */
    private function fakeRenderer(): void
    {
        $this->partialMock(DocumentService::class)->shouldReceive('run')->andReturnUsing(function ($input) {
            if ($input['operation'] === 'convert') {
                $bytes = '%PDF-'.file_get_contents($input['docxPath']);
            } elseif ($input['operation'] === 'header') {
                return ['image' => base64_encode(file_get_contents($input['templatePath']).':'.$input['ratio'])];
            } else {
                $bytes = 'PK'.json_encode([
                    $input['exam']['title'], $input['exam']['content']['questions'][0]['statement'],
                    $input['exam']['profile_snapshot'], $input['className'], $input['teacherName'],
                    $input['header'], $input['templatePath'] ? file_get_contents($input['templatePath']) : null,
                    $input['answerKey'] ? $input['exam']['content']['questions'][0]['answer'] : 'SEM GABARITO',
                ], JSON_UNESCAPED_UNICODE);
            }
            file_put_contents($input['outputPath'], $bytes);
            return ['ok' => true];
        });
    }

    public function test_approval_enqueues_both_variants_without_rendering_or_duplicating_same_approval(): void
    {
        $exam = $this->exam('draft');
        Queue::fake();
        $this->partialMock(DocumentService::class)->shouldNotReceive('run');
        $payload = ['op' => 'update', 'filters' => [['id', $exam->id]], 'values' => ['status' => 'approved']];
        $this->postJson('/api/data/sala_exams', $payload)->assertOk();
        Queue::assertPushed(PrepareExamDownload::class, 2);
        foreach ([false, true] as $answerKey) {
            Queue::assertPushed(PrepareExamDownload::class, fn ($job) =>
                $job->examId === $exam->id && $job->userId === $exam->user_id && $job->answerKey === $answerKey
                && $job->connection === 'documents' && $job->queue === 'documents' && $job->afterCommit === true);
        }
        $this->postJson('/api/data/sala_exams', $payload)->assertOk();
        Queue::assertPushed(PrepareExamDownload::class, 2);
    }

    public function test_queue_publishes_only_after_commit_and_discards_rolled_back_jobs(): void
    {
        $exam = $this->exam();
        DB::beginTransaction();
        PrepareExamDownload::dispatch($exam->user_id, $exam->id, false);
        $this->assertSame(0, DB::table('jobs')->where('queue', 'documents')->count());
        DB::rollBack();
        $this->assertSame(0, DB::table('jobs')->where('queue', 'documents')->count());
        DB::transaction(function () use ($exam) {
            PrepareExamDownload::dispatch($exam->user_id, $exam->id, false);
            $this->assertSame(0, DB::table('jobs')->where('queue', 'documents')->count());
        });
        $this->assertSame(1, DB::table('jobs')->where('queue', 'documents')->count());
        $this->assertGreaterThan((new PrepareExamDownload($exam->user_id, $exam->id, false))->timeout, config('queue.connections.documents.retry_after'));
    }

    public function test_database_worker_consumes_approval_jobs_and_http_reuses_all_prepared_files(): void
    {
        $exam = $this->exam('draft');
        $this->fakeRenderer();
        $this->postJson('/api/data/sala_exams', ['op' => 'update', 'filters' => [['id', $exam->id]],
            'values' => ['status' => 'approved']])->assertOk();
        $this->assertSame(2, DB::table('jobs')->where('queue', 'documents')->count());
        foreach ([1, 2] as $step) {
            // Executa o trabalhador real, incluindo desserialização e resolução do serviço.
            Artisan::call('queue:work', ['connection' => 'documents', '--queue' => 'documents',
                '--once' => true, '--sleep' => 0, '--tries' => 1]);
        }
        $this->assertSame(0, DB::table('jobs')->where('queue', 'documents')->count());
        $this->assertSame(0, DB::table('failed_jobs')->count());
        $this->partialMock(DocumentService::class)->shouldNotReceive('run');
        foreach (['pdf', 'docx'] as $format) {
            foreach ([false, true] as $answerKey) {
                $response = $this->postJson('/api/export/exam', ['id' => $exam->id, 'format' => $format, 'answerKey' => $answerKey])->assertOk();
                $this->assertStringContainsString($format.'_cache;desc="hit"', $response->headers->get('Server-Timing'));
            }
        }
    }

    public function test_preparation_makes_all_four_downloads_reusable_beyond_old_five_minute_cache(): void
    {
        $exam = $this->exam();
        $this->fakeRenderer();
        foreach ([false, true] as $answerKey) {
            (new PrepareExamDownload($exam->user_id, $exam->id, $answerKey))->handle(app(DocumentService::class));
        }
        $this->assertCount(4, Storage::disk('local')->allFiles('export-artifacts'));
        $this->partialMock(DocumentService::class)->shouldNotReceive('run');
        $this->travel(6)->minutes();
        foreach (['pdf', 'docx'] as $format) {
            foreach ([false, true] as $answerKey) {
                $response = $this->postJson('/api/export/exam', ['id' => $exam->id, 'format' => $format, 'answerKey' => $answerKey])->assertOk();
                $this->assertStringContainsString($format.'_cache;desc="hit"', $response->headers->get('Server-Timing'));
                $this->assertSame($answerKey, str_contains($response->getContent(), 'RESPOSTA RESERVADA'));
            }
        }
        // Mesmo no caminho rápido, outro professor não consegue acessar os arquivos preparados.
        $this->actingAs(User::factory()->create());
        $this->postJson('/api/export/exam', ['id' => $exam->id, 'format' => 'pdf'])->assertNotFound();
    }

    public function test_timestamp_only_save_reuses_file_but_document_changes_invalidate_it(): void
    {
        $exam = $this->exam();
        $this->fakeRenderer();
        $download = fn () => $this->postJson('/api/export/exam', ['id' => $exam->id, 'format' => 'pdf'])->assertOk();
        $original = $download()->getContent();
        $exam->updated_at = now()->addMinute();
        $exam->save();
        $same = $download();
        $same->assertContent($original);
        $this->assertStringContainsString('pdf_cache;desc="hit"', $same->headers->get('Server-Timing'));

        $changes = [
            function () use ($exam) { $exam->title = 'Novo título'; $exam->save(); },
            function () use ($exam) { $content = $exam->content; $content['questions'][0]['statement'] = 'Explique como a planta obtém energia.'; $exam->content = $content; $exam->save(); },
            function () use ($exam) { $exam->profile_snapshot = ['name' => 'Nome corrigido', 'code' => 'A001']; $exam->save(); },
            fn () => ClassRoom::whereKey($exam->class_id)->update(['name' => 'Turma renomeada']),
            function () { $user = auth()->user(); $user->name = 'Professora renomeada'; $user->save(); },
        ];
        foreach ($changes as $change) {
            $change();
            $response = $download();
            $this->assertNotSame($original, $response->getContent());
            $this->assertStringContainsString('pdf_cache;desc="miss"', $response->headers->get('Server-Timing'));
            $original = $response->getContent();
        }
    }

    public function test_template_bytes_and_header_crop_invalidate_prepared_files(): void
    {
        $exam = $this->exam();
        $this->fakeRenderer();
        $template = new ExamTemplate;
        $template->forceFill(['user_id' => $exam->user_id, 'name' => 'Modelo', 'filename' => 'modelo.pdf',
            'path' => $exam->user_id.'/modelo.pdf', 'processing_status' => 'ready', 'pdf_header_ratio' => .25])->save();
        Storage::disk('local')->put('sala-templates/'.$template->path, '%PDF-modelo-original');
        $exam->template_id = $template->id;
        $exam->save();
        $download = fn () => $this->postJson('/api/export/exam', ['id' => $exam->id, 'format' => 'docx'])->assertOk();
        $original = $download()->getContent();
        $template->pdf_header_ratio = .3;
        $template->save();
        $cropped = $download()->getContent();
        $this->assertNotSame($original, $cropped);
        Storage::disk('local')->put('sala-templates/'.$template->path, '%PDF-modelo-substituido');
        $this->assertNotSame($cropped, $download()->getContent());
    }

    public function test_cache_never_substitutes_a_different_exam_even_with_matching_metadata(): void
    {
        $exam = $this->exam();
        $other = $exam->replicate();
        $content = $other->content;
        $content['questions'][0]['statement'] = 'Descreva o ciclo da água na natureza.';
        $other->content = $content;
        $other->save();
        $this->fakeRenderer();
        $first = $this->postJson('/api/export/exam', ['id' => $exam->id, 'format' => 'pdf'])->assertOk();
        $second = $this->postJson('/api/export/exam', ['id' => $other->id, 'format' => 'pdf'])->assertOk();
        $this->assertNotSame($first->getContent(), $second->getContent());
        $this->assertStringContainsString('pdf_cache;desc="miss"', $second->headers->get('Server-Timing'));
        $this->assertStringNotContainsString('Explique a fotossíntese.', $second->getContent());
        $this->assertCount(4, Storage::disk('local')->allFiles('export-artifacts'));
        // Mesmo com uma colisão artificial de conteúdo na fixture, o ID da prova separa o cache.
        $identical = $exam->replicate();
        $identical->save();
        $third = $this->postJson('/api/export/exam', ['id' => $identical->id, 'format' => 'pdf'])->assertOk();
        $this->assertStringContainsString('pdf_cache;desc="miss"', $third->headers->get('Server-Timing'));
        $this->assertCount(6, Storage::disk('local')->allFiles('export-artifacts'));
    }

    public function test_edit_revokes_approval_and_stale_job_cannot_prepare_or_serve_old_file(): void
    {
        $exam = $this->exam();
        Queue::fake();
        $this->fakeRenderer();
        (new PrepareExamDownload($exam->user_id, $exam->id, false))->handle(app(DocumentService::class));
        $this->postJson('/api/data/sala_exams', ['op' => 'update', 'filters' => [['id', $exam->id]],
            'values' => ['title' => 'Título editado', 'status' => 'approved']])->assertOk();
        $this->assertSame('draft', $exam->fresh()->status);
        $this->partialMock(DocumentService::class)->shouldNotReceive('run');
        (new PrepareExamDownload($exam->user_id, $exam->id, false))->handle(app(DocumentService::class));
        (new PrepareExamDownload(User::factory()->create()->id, $exam->id, true))->handle(app(DocumentService::class));
        $this->postJson('/api/export/exam', ['id' => $exam->id, 'format' => 'pdf'])->assertConflict();
        Queue::assertNothingPushed();
        $exam->delete();
        (new PrepareExamDownload($exam->user_id, $exam->id, false))->handle(app(DocumentService::class));
    }

    public function test_expiry_cleanup_and_corrupt_artifacts_do_not_affect_uploaded_models(): void
    {
        Storage::fake('local');
        $store = app(ExportArtifacts::class);
        $store->put('old', '%PDF-antigo');
        $old = Storage::disk('local')->allFiles('export-artifacts')[0];
        touch(Storage::disk('local')->path($old), now()->timestamp - ExportArtifacts::RETENTION_SECONDS - 1);
        $store->put('current', 'PK-atual');
        Storage::disk('local')->put('sala-templates/modelo.pdf', '%PDF-preservado');
        $this->assertNull($store->get('old'));
        $this->artisan('provaai:cleanup-downloads')->expectsOutput('Arquivos de download expirados removidos: 1')->assertSuccessful();
        Storage::disk('local')->assertExists('sala-templates/modelo.pdf');
        $this->assertSame('PK-atual', $store->get('current'));
        $store->put('corrupt', 'arquivo-incompleto');
        $this->assertNull($store->get('corrupt'));
        // Gravar outra versão da mesma chave usa substituição atômica, não concatenação.
        $store->put('current', 'PK-substituido');
        $this->assertSame('PK-substituido', $store->get('current'));
    }

    public function test_operator_can_prepare_existing_approvals_with_a_bounded_command(): void
    {
        $exam = $this->exam();
        Queue::fake();
        $this->artisan('provaai:prepare-downloads --limit=1')->assertSuccessful();
        Queue::assertPushed(PrepareExamDownload::class, 2);
        Queue::assertPushed(PrepareExamDownload::class, fn ($job) => $job->examId === $exam->id);
        $this->artisan('provaai:prepare-downloads --limit=0')->assertFailed();
        Queue::assertPushed(PrepareExamDownload::class, 2);
    }
}
