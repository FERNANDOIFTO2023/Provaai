<?php

namespace Tests\Feature;

use App\Models\ClassRoom;
use App\Models\Student;
use App\Models\User;
use App\Services\StudentSpreadsheet;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Writer\XLSX\Options;
use OpenSpout\Writer\XLSX\Writer;
use Tests\TestCase;
use ZipArchive;

/** Arquivos reais em banco isolado: prévia, atomicidade, códigos, reenvio e isolamento por professor. */
class StudentImportTest extends TestCase
{
    use RefreshDatabase;

    private array $temporaryFiles = [];

    protected function tearDown(): void
    {
        parent::tearDown();
        foreach ($this->temporaryFiles as $path) {
            if (is_file($path)) unlink($path);
        }
    }

    private function room(?User $user = null): ClassRoom
    {
        $user ??= User::factory()->create();
        $this->actingAs($user);
        $room = new ClassRoom;
        $room->forceFill(['user_id' => $user->id, 'name' => '7º A', 'grade' => '7º ano', 'subject' => 'Ciências'])->save();
        return $room;
    }

    private function file(array $rows, ?array $headers = null, bool $shared = false): UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'students-');
        $this->temporaryFiles[] = $path;
        $options = new Options;
        $options->SHOULD_USE_INLINE_STRINGS = !$shared;
        $writer = new Writer($options);
        $writer->openToFile($path);
        $writer->getCurrentSheet()->setName('Alunos');
        $writer->addRow(Row::fromValues($headers ?? StudentSpreadsheet::HEADERS));
        foreach ($rows as $row) $writer->addRow(Row::fromValues($row));
        $writer->close();
        return new UploadedFile($path, 'alunos.xlsx', null, null, true);
    }

    private function send(ClassRoom $room, UploadedFile $file, bool $preview = false)
    {
        return $this->postJson('/api/students/import', ['class_id' => $room->id, 'file' => $file, 'preview' => $preview]);
    }

    public function test_preview_does_not_save_and_confirmation_assigns_codes_after_archived_students(): void
    {
        $room = $this->room();
        $existing = new Student;
        $existing->forceFill(['user_id' => $room->user_id, 'class_id' => $room->id, 'name' => 'Anterior', 'code' => 'A009', 'archived_at' => now()])->save();
        $file = $this->file([['Ana Silva', '', 'Frações', 'Enunciados curtos'], [], ['João Santos', 'Avançado']], shared: true);
        $this->send($room, $file, true)->assertOk()->assertJsonPath('count', 2)->assertJsonPath('students.1.line', 4)->assertJsonPath('students.0.level', 'Intermediário');
        $this->assertDatabaseCount('sala_students', 1);
        $this->send($room, $file)->assertCreated()->assertJsonPath('students.0.code', 'A010')->assertJsonPath('students.1.code', 'A011');
        $this->assertDatabaseHas('sala_students', ['name' => 'Ana Silva', 'difficulties' => 'Frações', 'criteria' => 'Enunciados curtos', 'user_id' => $room->user_id, 'class_id' => $room->id]);
        $this->send($room, $file)->assertUnprocessable()->assertJsonPath('errors.0.line', 2);
        $this->assertDatabaseCount('sala_students', 3);
        // Confirma que o cadastro manual continua a numeração da importação.
        $this->postJson('/api/data/sala_students', ['op' => 'insert', 'single' => 'single', 'values' => ['class_id' => $room->id, 'name' => 'Manual']])->assertOk()->assertJsonPath('data.code', 'A012');
    }

    public function test_excel_into_existing_class_creates_only_owned_copies_and_never_opens_source_class(): void
    {
        $owner = User::factory()->create();
        $source = $this->room($owner);
        $original = new Student;
        $original->forceFill(['user_id' => $owner->id, 'class_id' => $source->id, 'name' => 'Ana Silva', 'code' => 'A007', 'criteria' => 'Original'])->save();
        $recipient = User::factory()->create();
        $target = $this->room($recipient);
        $file = $this->file([['Ana Silva', 'Avançado', 'Objetivo editado', 'Critério da cópia']]);
        // Conhecer o ID da origem ou anexar uma lista não autoriza escrever na turma alheia.
        $this->send($source, $file, true)->assertNotFound();
        $this->send($source, $file)->assertNotFound();
        $this->postJson('/api/students/import', ['class_id' => $target->id, 'file' => $file, 'preview' => false,
            'user_id' => $owner->id, 'student_id' => $original->id])->assertCreated()
            ->assertJsonPath('students.0.user_id', $recipient->id)->assertJsonPath('students.0.class_id', $target->id)
            ->assertJsonPath('students.0.code', 'A001');
        $this->assertSame('Original', $original->fresh()->criteria);
        $this->assertSame('A007', $original->fresh()->code);
        $this->assertDatabaseCount('sala_classes', 2);
        $this->assertDatabaseCount('sala_students', 2);
        $this->postJson('/api/data/sala_classes', ['op' => 'select', 'filters' => [['id', $source->id]]])->assertExactJson(['data' => []]);
        $copy = Student::ownedBy($recipient->id)->sole();
        $this->assertNotSame($original->id, $copy->id);
        $this->actingAs($owner)->postJson('/api/data/sala_students', ['op' => 'select', 'filters' => [['id', $copy->id]]])->assertExactJson(['data' => []]);
    }

    public function test_validation_is_atomic_and_reports_original_rows(): void
    {
        $room = $this->room();
        $file = $this->file([['Aluno Válido'], [], ['', 'Inexistente', str_repeat('x', 2001)], ['X', '', '', str_repeat('x', 2001)]]);
        $response = $this->send($room, $file)->assertUnprocessable();
        $this->assertContains(4, array_column($response->json('errors'), 'line'));
        $this->assertContains(5, array_column($response->json('errors'), 'line'));
        $this->assertDatabaseCount('sala_students', 0);
    }

    public function test_duplicate_names_are_checked_with_case_and_spacing_normalized(): void
    {
        $room = $this->room();
        $this->send($room, $this->file([[' Ana Silva '], ['ANA   SILVA']]))->assertUnprocessable()->assertJsonPath('errors.0.line', 3);
        $this->assertDatabaseCount('sala_students', 0);
    }

    public function test_confirmation_rechecks_changes_after_preview(): void
    {
        $room = $this->room();
        $file = $this->file([['Ana Silva']]);
        $this->send($room, $file, true)->assertOk();
        $this->send($room, $file)->assertCreated();
        $this->send($room, $file)->assertUnprocessable();
        $room->update(['archived_at' => now()]);
        $this->send($room, $this->file([['Outro aluno']]))->assertConflict();
        $this->assertDatabaseCount('sala_students', 1);
    }

    public function test_authentication_ownership_and_archived_class(): void
    {
        $room = $this->room();
        $file = $this->file([['Ana Silva']]);
        $this->actingAs(User::factory()->create());
        $this->send($room, $file)->assertNotFound();
        $this->app['auth']->forgetGuards();
        $this->send($room, $file)->assertUnauthorized();
        $this->assertDatabaseCount('sala_students', 0);
    }

    public function test_rejects_changed_headers_extra_columns_formula_and_empty_template(): void
    {
        $room = $this->room();
        $this->send($room, $this->file([['Ana Silva']], ['Nome', 'Código']))->assertUnprocessable()->assertJsonValidationErrors('file');
        $this->send($room, $this->file([['Ana Silva', '', '', '', 'A001']]))->assertUnprocessable();
        $this->send($room, $this->file([['=1+1']]))->assertUnprocessable();
        $this->send($room, $this->file([]))->assertUnprocessable();
        $this->assertDatabaseCount('sala_students', 0);
    }

    public function test_rejects_invalid_files_and_limits(): void
    {
        $room = $this->room();
        $this->send($room, UploadedFile::fake()->createWithContent('alunos.xlsx', 'não é um xlsx'))->assertUnprocessable();
        $this->send($room, UploadedFile::fake()->create('alunos.xlsx', 5121))->assertUnprocessable();
        $this->send($room, UploadedFile::fake()->create('alunos.csv', 1))->assertUnprocessable();
        $this->send($room, $this->file(array_map(fn ($i) => ["Aluno $i"], range(1, 501))))->assertUnprocessable();
        $this->assertDatabaseCount('sala_students', 0);
    }

    public function test_accepts_500_students_and_codes_cross_three_digits(): void
    {
        $room = $this->room();
        $record = new Student;
        $record->forceFill(['user_id' => $room->user_id, 'class_id' => $room->id, 'name' => 'Anterior', 'code' => 'A999'])->save();
        $this->send($room, $this->file(array_map(fn ($i) => ["Aluno $i"], range(1, 500))))
            ->assertCreated()->assertJsonPath('count', 500)->assertJsonPath('students.0.code', 'A1000')->assertJsonPath('students.499.code', 'A1499');
    }

    public function test_rejects_expanded_zip_and_dtd(): void
    {
        $room = $this->room();
        foreach (['bomb.xml' => str_repeat('x', 21 * 1024 * 1024), 'external.xml' => '<!DOCTYPE a [<!ENTITY x SYSTEM "file:///secret">]><a>&x;</a>'] as $name => $content) {
            $file = $this->file([['Ana Silva']]);
            $zip = new ZipArchive;
            $zip->open($file->getPathname());
            $zip->addFromString($name, $content);
            $zip->close();
            $this->send($room, $file)->assertUnprocessable();
        }
        $this->assertDatabaseCount('sala_students', 0);
    }

    public function test_downloadable_template_is_compatible_and_does_not_import_instructions(): void
    {
        $room = $this->room();
        $path = tempnam(sys_get_temp_dir(), 'template-');
        $this->temporaryFiles[] = $path;
        copy(public_path('modelos/modelo-alunos.xlsx'), $path);
        $file = new UploadedFile($path, 'modelo-alunos.xlsx', null, null, true);
        $this->send($room, $file)->assertUnprocessable()->assertJsonValidationErrors('file');
        // Simula preencher o arquivo publicado, preservando estilos, validações e aba de instruções.
        $zip = new ZipArchive;
        $zip->open($path);
        $xml = new \DOMDocument;
        $xml->loadXML($zip->getFromName('xl/worksheets/sheet1.xml'));
        $xpath = new \DOMXPath($xml);
        $xpath->registerNamespace('s', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main');
        $row = $xpath->query('//s:row[@r="2"]')->item(0);
        while ($row->firstChild) $row->removeChild($row->firstChild);
        $cell = $xml->createElementNS($xml->documentElement->namespaceURI, 'c');
        $cell->setAttribute('r', 'A2'); $cell->setAttribute('t', 'inlineStr');
        $inline = $xml->createElementNS($xml->documentElement->namespaceURI, 'is');
        $inline->appendChild($xml->createElementNS($xml->documentElement->namespaceURI, 't', 'Ana Modelo'));
        $cell->appendChild($inline); $row->appendChild($cell);
        $zip->addFromString('xl/worksheets/sheet1.xml', $xml->saveXML());
        $zip->close();
        $this->send($room, $file)->assertCreated()->assertJsonPath('count', 1)->assertJsonPath('students.0.code', 'A001')->assertJsonPath('students.0.name', 'Ana Modelo');
    }
}
