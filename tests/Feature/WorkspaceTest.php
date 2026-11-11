<?php

namespace Tests\Feature;

use App\Jobs\GenerateBatchStep;
use App\Models\ClassRoom;
use App\Models\Exam;
use App\Models\ExamTemplate;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class WorkspaceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
        $this->withoutVite();
    }

    private function teacher(): User
    {
        return User::factory()->create();
    }

    private function record(string $table, array $values, string $op = 'insert', array $filters = [])
    {
        return $this->postJson('/api/data/'.$table, ['op' => $op, 'values' => $values, 'filters' => $filters, 'single' => 'single']);
    }

    private function room(User $user): ClassRoom
    {
        $r = new ClassRoom;
        $r->forceFill(['user_id' => $user->id, 'name' => '7º A', 'grade' => '7º ano', 'subject' => 'Ciências'])->save();

        return $r;
    }

    private function student(User $user, ClassRoom $room): Student
    {
        $s = new Student;
        $s->forceFill(['user_id' => $user->id, 'class_id' => $room->id, 'name' => 'Ana Exemplo', 'code' => 'A001'])->save();

        return $s;
    }

    private function content(): array
    {
        return ['instructions' => 'Responda.', 'questions' => [['type' => 'essay', 'statement' => 'Explique a fotossíntese.', 'options' => [], 'answer' => 'Produção de açúcares pela luz.', 'objective' => 'Compreender fotossíntese.', 'points' => 10]], 'objectiveCount' => 0];
    }

    public function test_anonymous_and_forged_activity_marker_cannot_read_data(): void
    {
        $this->withHeader('Authorization', 'Bearer activity.fake.local')->postJson('/api/data/sala_classes', ['op' => 'select'])->assertUnauthorized();
        $this->postJson('/api/generate', ['examId' => (string) Str::uuid()])->assertUnauthorized();
    }

    public function test_crud_enforces_ownership_and_server_student_codes(): void
    {
        $a = $this->teacher();
        $b = $this->teacher();
        $room = $this->room($a);
        $foreign = $this->room($b);
        $this->actingAs($a);
        $this->record('sala_students', ['name' => 'Ana Exemplo', 'class_id' => $foreign->id, 'difficulties' => '', 'criteria' => ''])->assertNotFound();
        $one = $this->record('sala_students', ['name' => 'Ana Exemplo', 'class_id' => $room->id, 'code' => 'A999', 'difficulties' => '', 'criteria' => ''])->assertOk()->json('data');
        $this->assertSame('A001', $one['code']);
        $this->record('sala_students', ['name' => 'Bruno Exemplo', 'class_id' => $room->id])->assertOk()->assertJsonPath('data.code', 'A002');
        $this->record('sala_classes', ['name' => 'Ataque'], 'update', [['id', $foreign->id]])->assertNotFound();
        $this->postJson('/api/data/sala_classes', ['op' => 'select'])->assertOk()->assertJsonCount(1, 'data');
        $this->postJson('/api/data/users', ['op' => 'select'])->assertNotFound();
    }

    public function test_class_lifecycle_has_calendar_year_deadline_and_requires_reason(): void
    {
        $user = $this->teacher();
        $room = $this->room($user);
        $this->actingAs($user);
        $this->travelTo(now()->setDate(2028, 2, 29)->startOfDay());
        $this->postJson('/api/actions/sala_set_class_active', ['p_class' => $room->id, 'p_active' => false])->assertOk();
        $this->assertSame('2029-02-28', $room->fresh()->deletion_due_at->toDateString());
        $this->postJson('/api/actions/sala_set_class_active', ['p_class' => $room->id, 'p_active' => true])->assertOk();
        $this->assertNull($room->fresh()->archived_at);
        $this->postJson('/api/actions/sala_delete_class', ['p_class' => $room->id, 'p_reason' => ''])->assertUnprocessable();
        $this->postJson('/api/actions/sala_delete_class', ['p_class' => $room->id, 'p_reason' => 'Turma encerrada pelo professor.'])->assertOk();
        $this->assertDatabaseHas('class_deletion_audits', ['class_id' => $room->id]);
        $this->assertDatabaseMissing('sala_classes', ['id' => $room->id]);
    }

    public function test_expired_classes_are_cleaned_and_cannot_be_reactivated(): void
    {
        $u = $this->teacher();
        $r = $this->room($u);
        $r->fill(['archived_at' => now()->subYears(2), 'deletion_due_at' => now()->subYear()])->save();
        $this->actingAs($u);
        $this->postJson('/api/actions/sala_set_class_active', ['p_class' => $r->id, 'p_active' => true])->assertConflict();
        $this->artisan('provaai:cleanup-classes')->assertSuccessful();
        $this->assertDatabaseMissing('sala_classes', ['id' => $r->id]);
    }

    public function test_sharing_makes_independent_copy_and_accept_is_idempotent(): void
    {
        $a = $this->teacher();
        $b = $this->teacher();
        $c = $this->teacher();
        $room = $this->room($a);
        $s = $this->student($a, $room);
        $invite = (string) Str::uuid();
        $this->actingAs($a)->postJson('/api/actions/sala_send_copy', ['p_id' => $invite, 'p_kind' => 'class', 'p_resource' => $room->id, 'p_email' => $b->email])->assertOk();
        $this->actingAs($c)->postJson('/api/actions/sala_accept_copy', ['p_invitation' => $invite])->assertNotFound();
        $copy = $this->actingAs($b)->postJson('/api/actions/sala_accept_copy', ['p_invitation' => $invite])->assertOk()->json('data');
        $this->postJson('/api/actions/sala_accept_copy', ['p_invitation' => $invite])->assertOk()->assertJsonPath('data', $copy);
        $this->record('sala_classes', ['name' => 'Minha cópia'], 'update', [['id', $copy]])->assertOk();
        $this->assertSame('7º A', $room->fresh()->name);
        $this->assertSame(1, Student::ownedBy($b->id)->count());
        $this->assertNotSame($s->id, Student::ownedBy($b->id)->first()->id);
    }

    public function test_exam_edit_requires_new_approval_and_foreign_template_is_rejected(): void
    {
        $u = $this->teacher();
        $room = $this->room($u);
        $s = $this->student($u, $room);
        $this->actingAs($u);
        $exam = $this->record('sala_exams', ['class_id' => $room->id, 'student_id' => $s->id, 'title' => 'Plantas', 'subject' => 'Ciências', 'topics' => 'Fotossíntese', 'question_count' => 1, 'content' => $this->content(), 'profile_snapshot' => ['name' => 'False']])->assertOk()->json('data');
        $this->assertSame($s->name, $exam['profile_snapshot']['name']);
        $this->record('sala_exams', ['status' => 'approved'], 'update', [['id', $exam['id']]])->assertOk()->assertJsonPath('data.status', 'approved');
        $this->record('sala_exams', ['title' => 'Plantas 2', 'status' => 'approved'], 'update', [['id', $exam['id']]])->assertOk()->assertJsonPath('data.status', 'draft');
        $this->postJson('/api/export/exam', ['id' => $exam['id'], 'format' => 'pdf'])->assertConflict();
        $other = $this->teacher();
        $template = new ExamTemplate;
        $template->forceFill(['user_id' => $other->id, 'name' => 'Modelo', 'filename' => 'a.pdf', 'path' => $other->id.'/a.pdf'])->save();
        $this->record('sala_classes', ['template_override_id' => $template->id], 'update', [['id', $room->id]])->assertNotFound();
    }

    public function test_student_copy_returns_destination_class_and_manual_duplicate_is_rejected(): void
    {
        $a = $this->teacher();
        $b = $this->teacher();
        $room = $this->room($a);
        $destination = $this->room($b);
        $student = $this->student($a, $room);
        $invite = (string) Str::uuid();
        $this->actingAs($a)->postJson('/api/actions/sala_send_copy', ['p_id' => $invite, 'p_kind' => 'student', 'p_resource' => $student->id, 'p_email' => $b->email])->assertOk();
        $this->actingAs($b)->postJson('/api/actions/sala_accept_copy', ['p_invitation' => $invite, 'p_class' => $destination->id])->assertOk()->assertJsonPath('data', $destination->id);
        $this->actingAs($a);
        $values = ['class_id' => $room->id, 'student_id' => $student->id, 'title' => 'Plantas', 'subject' => 'Ciências', 'topics' => 'Fotossíntese', 'question_count' => 1, 'content' => $this->content()];
        $values['content']['questions'][0]['points'] = 25;
        $this->record('sala_exams', $values)->assertOk();
        $this->record('sala_exams', $values)->assertUnprocessable();
    }

    public function test_batches_dispatch_jobs_and_reject_concurrent_start(): void
    {
        $u = $this->teacher();
        $r = $this->room($u);
        $s = $this->student($u, $r);
        $this->actingAs($u);
        $input = ['classId' => $r->id, 'students' => [$s->id], 'title' => 'Prova', 'subject' => 'Ciências', 'topics' => 'Fotossíntese', 'count' => 2, 'objectiveCount' => 1, 'choice' => 'builtin'];
        $this->postJson('/api/actions/sala_begin_exam_batch', ['p_input' => $input])->assertOk();
        Queue::assertPushed(GenerateBatchStep::class);
        $this->assertDatabaseCount('sala_exams', 1);
        $this->postJson('/api/actions/sala_begin_exam_batch', ['p_input' => $input])->assertConflict();
        $this->assertSame('Ciências', Exam::first()->subject);
    }

    public function test_retry_queues_only_the_owned_empty_draft_with_the_requested_mix(): void
    {
        $teacher = $this->teacher();
        $room = $this->room($teacher);
        $student = $this->student($teacher, $room);
        $draft = new Exam;
        $draft->forceFill(['user_id' => $teacher->id, 'class_id' => $room->id, 'student_id' => $student->id,
            'title' => 'Inglês', 'subject' => 'Inglês', 'topics' => 'Simple present', 'question_count' => 10,
            'content' => ['questions' => [], 'instructions' => 'Leia com atenção.', 'objectiveCount' => 5], 'profile_snapshot' => []])->save();
        $url = '/api/actions/sala_begin_exam_batch';
        $payload = ['p_input' => ['retry' => $draft->id, 'objectiveCount' => 0]];
        $this->actingAs($this->teacher())->postJson($url, $payload)->assertNotFound();
        $this->actingAs($teacher);
        $student->forceFill(['archived_at' => now()])->save();
        $this->postJson($url, $payload)->assertConflict();
        $student->forceFill(['archived_at' => null])->save();
        $draft->content = $this->content();
        $draft->save();
        $this->postJson($url, $payload)->assertConflict();
        $draft->content = ['questions' => [], 'objectiveCount' => 5, 'instructions' => 'Leia com atenção.'];
        $draft->save();
        $this->postJson($url, $payload)->assertOk();
        $this->postJson($url, $payload)->assertConflict();
        $this->assertSame([$draft->id], \App\Models\ExamBatch::findOrFail($teacher->id)->exam_ids);
        $this->assertSame(0, $draft->fresh()->content['objectiveCount']);
        $this->assertSame('Simple present', $draft->fresh()->topics);
        $this->assertDatabaseCount('sala_exams', 1);
        Queue::assertPushed(GenerateBatchStep::class, 1);
    }

    public function test_file_access_is_private_and_path_traversal_is_rejected(): void
    {
        Storage::fake('local');
        $a = $this->teacher();
        $b = $this->teacher();
        Storage::disk('local')->put('sala-templates/'.$a->id.'/a.pdf', 'private');
        $this->actingAs($b)->getJson('/api/files/sala-templates?path='.urlencode($a->id.'/a.pdf'))->assertUnprocessable();
        $this->getJson('/api/files/sala-templates?path='.urlencode($b->id.'/../'.$a->id.'/a.pdf'))->assertUnprocessable();
        $this->actingAs($a)->get('/api/files/sala-templates?path='.urlencode($a->id.'/a.pdf'))->assertOk()->assertStreamedContent('private');
    }

    public function test_email_code_reuses_deadline_and_login_uses_server_session(): void
    {
        $code = null;
        Mail::shouldReceive('raw')->once()->andReturnUsing(function ($text, $callback) use (&$code) {
            preg_match('/\b(\d{6})\b/', $text, $m);
            $code = $m[1];
        });
        $one = $this->postJson('/api/auth/code', ['action' => 'request', 'email' => 'teacher@example.com'])->assertOk()->json();
        $this->postJson('/api/auth/code', ['action' => 'request', 'email' => 'teacher@example.com'])->assertOk()->assertJsonPath('reused', true)->assertJsonPath('expiresAt', $one['expiresAt']);
        $this->postJson('/api/auth/code', ['action' => 'verify', 'email' => 'teacher@example.com', 'code' => '000000'])->assertUnprocessable();
        $this->postJson('/api/auth/code', ['action' => 'verify', 'email' => 'teacher@example.com', 'code' => $code])->assertOk()->assertJsonPath('session.user.email','teacher@example.com');
        $this->getJson('/api/auth/session')->assertOk()->assertJsonPath('session.user.email','teacher@example.com');
        $this->postJson('/api/auth/logout')->assertOk();
        $this->postJson('/api/data/sala_classes',['op' => 'select'])->assertUnauthorized();
    }
}
