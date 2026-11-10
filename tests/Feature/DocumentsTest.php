<?php

namespace Tests\Feature;

use App\Models\ClassRoom;
use App\Models\Exam;
use App\Models\ExamTemplate;
use App\Models\Student;
use App\Models\User;
use App\Services\DocumentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class DocumentsTest extends TestCase
{
    use RefreshDatabase;

    public function test_pdf_preview_cache_and_word_processing_use_laravel_routes(): void
    {
        Storage::fake('local');
        $u = User::factory()->create();
        $this->actingAs($u);
        foreach (['pdf', 'docx'] as $ext) {
            $path = $u->id.'/model.'.$ext;
            Storage::disk('local')->put('sala-templates/'.$path, file_get_contents(base_path('tests/fixtures/model.'.$ext)));
            $t = new ExamTemplate;
            $t->forceFill(['user_id' => $u->id, 'name' => 'Modelo', 'filename' => 'model.'.$ext, 'path' => $path])->save();
            $this->postJson('/api/template/process', ['templateId' => $t->id])->assertOk()->assertJsonPath('template.processing_status', 'ready');
            if ($ext === 'pdf') {
                $this->postJson('/api/template/process', ['templateId' => $t->id, 'preview' => true])->assertOk()->assertHeader('Content-Type', 'image/png');
                $service = app(DocumentService::class);
                $before = microtime(true);
                $one = $service->header($t, .25);
                $two = $service->header($t, .25);
                $this->assertSame($one, $two);
                $this->assertArrayHasKey('image', $two);
                $this->postJson('/api/template/process', ['templateId' => $t->id, 'headerRatio' => .8])->assertUnprocessable();
            } else {
                $this->assertStringContainsString('Fotossíntese', $t->fresh()->extracted_text);
            }
        }
    }

    public function test_approved_exam_exports_pdf_and_docx_through_laravel(): void
    {
        Storage::fake('local');
        $u = User::factory()->create();
        $this->actingAs($u);
        $r = new ClassRoom;
        $r->forceFill(['user_id' => $u->id, 'name' => '7º A', 'subject' => 'Ciências', 'grade' => '7'])->save();
        $s = new Student;
        $s->forceFill(['user_id' => $u->id, 'class_id' => $r->id, 'name' => 'Aluno Fictício', 'code' => 'A001'])->save();
        $path = $u->id.'/model.pdf';
        Storage::disk('local')->put('sala-templates/'.$path, file_get_contents(base_path('tests/fixtures/model.pdf')));
        $t = new ExamTemplate;
        $t->forceFill(['user_id' => $u->id, 'name' => 'Modelo', 'filename' => 'model.pdf', 'path' => $path, 'processing_status' => 'ready'])->save();
        $e = new Exam;
        $e->forceFill(['user_id' => $u->id, 'class_id' => $r->id, 'student_id' => $s->id, 'template_id' => $t->id, 'title' => 'Fotossíntese', 'subject' => 'Ciências', 'topics' => 'Plantas', 'question_count' => 1, 'status' => 'approved',
            'profile_snapshot' => ['name' => $s->name, 'code' => $s->code], 'content' => ['instructions' => 'Responda.', 'questions' => [['type' => 'essay', 'statement' => 'Explique a fotossíntese.', 'options' => [], 'answer' => 'RESPOSTA RESERVADA', 'objective' => 'Compreender', 'points' => 10]]]])->save();
        $pdf = $this->postJson('/api/export/exam', ['id' => $e->id, 'format' => 'pdf'])->assertOk()->assertHeader('Content-Type', 'application/pdf')->getContent();
        $this->assertStringStartsWith('%PDF-', $pdf);
        $docx = $this->postJson('/api/export/exam', ['id' => $e->id, 'format' => 'docx'])->assertOk()->getContent();
        $this->assertStringStartsWith('PK',$docx);
    }
}
