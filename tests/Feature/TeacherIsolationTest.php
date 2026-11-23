<?php

namespace Tests\Feature;

use App\Models\{ClassRoom, CopyInvitation, Exam, ExamTemplate, Student, User};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\{Cache, Queue, Storage};
use Illuminate\Support\Str;
use Tests\TestCase;

/** Três contas isoladas: proprietário, destinatário autorizado e terceiro sem convite. */
class TeacherIsolationTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private User $recipient;
    private User $outsider;
    private ClassRoom $room;
    private Student $student;

    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
        $this->owner = User::factory()->create();
        $this->recipient = User::factory()->create();
        $this->outsider = User::factory()->create();
        $this->room = $this->roomFor($this->owner);
        $this->student = new Student;
        $this->student->forceFill(['user_id' => $this->owner->id, 'class_id' => $this->room->id,
            'name' => 'Aluno original', 'code' => 'A001', 'criteria' => 'Critério privado'])->save();
    }

    private function roomFor(User $user): ClassRoom
    {
        $room = new ClassRoom;
        $room->forceFill(['user_id' => $user->id, 'name' => 'Turma privada', 'grade' => '7º ano', 'subject' => 'Ciências'])->save();
        return $room;
    }

    private function invite(string $kind = 'class'): string
    {
        $id = (string) Str::uuid();
        $this->actingAs($this->owner)->postJson('/api/actions/sala_send_copy', [
            'p_id' => $id, 'p_kind' => $kind, 'p_resource' => $kind === 'class' ? $this->room->id : $this->student->id,
            'p_email' => $this->recipient->email,
        ])->assertOk();
        return $id;
    }

    public function test_ids_and_forged_owner_filters_do_not_allow_reading_or_editing_other_accounts(): void
    {
        $this->actingAs($this->outsider);
        foreach (['sala_classes' => $this->room, 'sala_students' => $this->student] as $resource => $record) {
            foreach ([[], [['id', $record->id]], [['user_id', $this->owner->id]]] as $filters) {
                $this->postJson('/api/data/'.$resource, ['op' => 'select', 'filters' => $filters,
                    'user_id' => $this->owner->id])->assertOk()->assertExactJson(['data' => []]);
            }
            $this->postJson('/api/data/'.$resource, ['op' => 'select', 'single' => 'single', 'filters' => [['id', $record->id]]])->assertNotFound();
            $this->postJson('/api/data/'.$resource, ['op' => 'update', 'filters' => [['id', $record->id]],
                'values' => ['name' => 'Alterado', 'user_id' => $this->outsider->id]])->assertNotFound();
        }
        $this->postJson('/api/data/sala_students', ['op' => 'insert', 'values' => ['name' => 'Invasão', 'class_id' => $this->room->id]])->assertNotFound();
        $this->assertSame('Turma privada', $this->room->fresh()->name);
        $this->assertSame('Aluno original', $this->student->fresh()->name);
        $this->assertDatabaseCount('sala_students', 1);
    }

    public function test_class_actions_and_cross_account_transfers_are_denied(): void
    {
        $mine = $this->roomFor($this->outsider);
        $this->actingAs($this->outsider);
        $this->postJson('/api/actions/sala_set_class_active', ['p_class' => $this->room->id, 'p_active' => false])->assertNotFound();
        $this->postJson('/api/actions/sala_delete_class', ['p_class' => $this->room->id, 'p_reason' => 'Excluir indevidamente'])->assertNotFound();
        $this->postJson('/api/actions/sala_reactivate_student', ['p_class' => $mine->id, 'p_student' => $this->student->id])->assertNotFound();
        $this->postJson('/api/data/sala_recovery_students', ['op' => 'upsert', 'values' => ['student_id' => $this->student->id]])->assertNotFound();
        $this->postJson('/api/actions/sala_send_copy', ['p_id' => (string) Str::uuid(), 'p_kind' => 'class',
            'p_resource' => $this->room->id, 'p_email' => $this->recipient->email])->assertNotFound();
        $this->actingAs($this->owner)->postJson('/api/actions/sala_reactivate_student', [
            'p_class' => $mine->id, 'p_student' => $this->student->id])->assertNotFound();
        $this->assertSame($this->room->id, $this->student->fresh()->class_id);
        $this->assertNull($this->room->fresh()->archived_at);
    }

    public function test_only_recipient_can_accept_and_copies_never_grant_access_to_originals(): void
    {
        $id = $this->invite();
        $this->actingAs($this->outsider)->postJson('/api/data/sala_copy_invitations', ['op' => 'select', 'filters' => [['id', $id]]])->assertExactJson(['data' => []]);
        $this->postJson('/api/actions/sala_accept_copy', ['p_invitation' => $id, 'recipient_email' => $this->recipient->email])->assertNotFound();
        $this->postJson('/api/actions/sala_cancel_copy', ['p_invitation' => $id])->assertNotFound();
        $this->actingAs($this->recipient)->postJson('/api/data/sala_copy_invitations', ['op' => 'select', 'single' => 'single', 'filters' => [['id', $id]], 'columns' => 'snapshot'])
            ->assertOk()->assertJsonMissingPath('data.snapshot');
        $this->postJson('/api/actions/sala_cancel_copy', ['p_invitation' => $id])->assertNotFound();
        $destination = $this->postJson('/api/actions/sala_accept_copy', ['p_invitation' => $id])->assertOk()->json('data');
        $copy = Student::ownedBy($this->recipient->id)->sole();
        $this->assertNotSame($copy->id, $this->student->id);
        $this->assertSame($destination, $copy->class_id);
        $this->postJson('/api/data/sala_students', ['op' => 'update', 'filters' => [['id', $copy->id]], 'values' => ['criteria' => 'Minha alteração']])->assertOk();
        $this->assertSame('Critério privado', $this->student->fresh()->criteria);
        $this->postJson('/api/data/sala_students', ['op' => 'select', 'filters' => [['id', $this->student->id]]])->assertExactJson(['data' => []]);
        $this->postJson('/api/data/sala_classes', ['op' => 'update', 'filters' => [['id', $this->room->id]], 'values' => ['name' => 'Invadida']])->assertNotFound();
        $this->actingAs($this->owner)->postJson('/api/data/sala_students', ['op' => 'select', 'filters' => [['id', $copy->id]]])->assertExactJson(['data' => []]);
        $this->postJson('/api/actions/sala_cancel_copy', ['p_invitation' => $id])->assertConflict();
        $this->assertNull(CopyInvitation::findOrFail($id)->revoked_at);
    }

    public function test_revocation_blocks_acceptance_and_destination_must_belong_to_recipient(): void
    {
        $id = $this->invite('student');
        $mine = $this->roomFor($this->recipient);
        $this->actingAs($this->recipient)->postJson('/api/actions/sala_accept_copy', ['p_invitation' => $id, 'p_class' => $this->room->id])->assertNotFound();
        $this->assertNull(CopyInvitation::findOrFail($id)->accepted_at);
        $this->actingAs($this->owner)->postJson('/api/actions/sala_cancel_copy', ['p_invitation' => $id])->assertOk();
        $this->actingAs($this->recipient)->postJson('/api/actions/sala_accept_copy', ['p_invitation' => $id, 'p_class' => $mine->id])->assertConflict();
        $this->assertSame(0, Student::ownedBy($this->recipient->id)->count());
        $fresh = $this->invite('student');
        $this->actingAs($this->recipient)->postJson('/api/actions/sala_accept_copy', ['p_invitation' => $fresh, 'p_class' => $mine->id])->assertOk()->assertJsonPath('data', $mine->id);
        $this->assertSame($mine->id, Student::ownedBy($this->recipient->id)->sole()->class_id);
    }

    public function test_exam_template_files_and_download_progress_remain_private(): void
    {
        Storage::fake('local');
        $path = $this->owner->id.'/privado.pdf';
        Storage::disk('local')->put('sala-templates/'.$path, '%PDF-privado');
        $template = new ExamTemplate;
        $template->forceFill(['user_id' => $this->owner->id, 'name' => 'Privado', 'filename' => 'privado.pdf', 'path' => $path])->save();
        $exam = new Exam;
        $exam->forceFill(['user_id' => $this->owner->id, 'class_id' => $this->room->id, 'student_id' => $this->student->id,
            'title' => 'Privada', 'subject' => 'Ciências', 'topics' => 'Células', 'question_count' => 1,
            'content' => ['instructions' => '', 'questions' => []], 'status' => 'draft', 'profile_snapshot' => []])->save();
        $this->actingAs($this->outsider);
        foreach (['sala_exams' => $exam, 'sala_templates' => $template] as $resource => $record) {
            $this->postJson('/api/data/'.$resource, ['op' => 'select', 'filters' => [['id', $record->id]]])->assertExactJson(['data' => []]);
        }
        $this->postJson('/api/export/exam', ['id' => $exam->id, 'format' => 'pdf'])->assertNotFound();
        $this->postJson('/api/generate', ['examId' => $exam->id])->assertNotFound();
        $this->postJson('/api/template/process', ['templateId' => $template->id])->assertNotFound();
        $this->getJson('/api/files/sala-templates?'.http_build_query(['path' => $path]))->assertUnprocessable();
        $this->deleteJson('/api/files/sala-templates', ['paths' => [$path]])->assertUnprocessable();
        Storage::disk('local')->assertExists('sala-templates/'.$path);
        $progress = (string) Str::uuid();
        Cache::put('download:'.$this->owner->id.':'.$progress, 'layout', 60);
        $this->getJson('/api/export/progress/'.$progress)->assertOk()->assertJsonPath('stage', null);
    }
}
