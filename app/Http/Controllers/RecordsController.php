<?php

namespace App\Http\Controllers;

use App\Models\ClassRoom;
use App\Models\CopyInvitation;
use App\Models\Exam;
use App\Models\ExamBatch;
use App\Models\ExamTemplate;
use App\Models\Student;
use App\Services\ExamValidator;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Validator;

class RecordsController extends Controller
{
    private const MODELS = ['sala_classes' => ClassRoom::class, 'sala_students' => Student::class, 'sala_exams' => Exam::class, 'sala_templates' => ExamTemplate::class, 'sala_exam_batches' => ExamBatch::class, 'sala_copy_invitations' => CopyInvitation::class];

    public function handle(Request $r, string $resource)
    {
        $input = $r->validate(['op' => 'required|in:select,insert,update,upsert,delete', 'filters' => 'array|max:10', 'order' => 'nullable|array', 'limit' => 'integer|min:1|max:1000', 'offset' => 'integer|min:0|max:100000', 'single' => 'nullable|in:single,maybe', 'values' => 'nullable|array', 'columns' => 'nullable|string|max:500']);
        $uid = $r->user()->id;
        $op = $input['op'];
        if (in_array($resource, ['sala_teacher_template_defaults', 'sala_recovery_students'])) {
            return $this->links($r, $resource, $uid, $input);
        }
        abort_unless(isset(self::MODELS[$resource]), 404);
        $model = self::MODELS[$resource];
        $query = $resource === 'sala_copy_invitations'
            ? $model::where(fn ($q) => $q->where('owner_id', $uid)->orWhere('recipient_email', $r->user()->email))
            : $model::ownedBy($uid);
        foreach ($input['filters'] ?? [] as $filter) {
            abort_unless(in_array($filter[0] ?? '', ['id', 'user_id', 'class_id', 'student_id', 'purpose', 'status', 'title', 'subject', 'topics', 'archived_at']), 422);
            $query->where($filter[0], $filter[1] ?? null);
        }
        if ($op === 'select') {
            if (isset($input['order'])) {
                abort_unless(in_array($input['order'][0], ['id', 'created_at', 'updated_at', 'name', 'code']), 422);
                $query->orderBy($input['order'][0], ($input['order'][1] ?? false) ? 'asc' : 'desc');
            }
            $query->offset($input['offset'] ?? 0);
            $rows = $query->limit($input['limit'] ?? 1000)->get();

            return response()->json(['data' => $this->shape($rows, $input)]);
        }
        abort_if(in_array($resource, ['sala_exam_batches', 'sala_copy_invitations']), 403);
        abort_unless(in_array($op, ['insert', 'update']), 405);

        return DB::transaction(function () use ($resource, $uid, $input, $op, $model, $query) {
            // Serializa cadastros e códigos do professor, inclusive entre abas.
            DB::table('users')->where('id', $uid)->lockForUpdate()->first();
            $record = $op === 'insert' ? new $model : $query->lockForUpdate()->firstOrFail();
            if ($record->exists) {
                Gate::authorize('update', $record);
            }
            $values = $input['values'] ?? [];
            $rules = $this->rules($resource, $op === 'insert');
            $data = Validator::make($values, $rules)->validate();
            if ($op === 'insert') {
                if (isset($values['id'])) {
                    $record->id = Validator::make($values, ['id' => 'required|uuid'])->validate()['id'];
                }
                $record->user_id = $uid;
            }
            foreach (['template_id', 'template_override_id'] as $key) {
                if (! empty($data[$key])) {
                    ExamTemplate::ownedBy($uid)->findOrFail($data[$key]);
                }
            }
            if (isset($data['banner_path'])) {
                $this->ownPath($data['banner_path'], $uid);
            }
            if ($resource === 'sala_students') {
                $room = ClassRoom::ownedBy($uid)->findOrFail($data['class_id'] ?? $record->class_id);
                abort_if($room->archived_at, 409, 'Reative a turma primeiro.');
                if ($op === 'insert') {
                    $data['code'] = $this->nextCode($room->id);
                } else {
                    unset($data['code'],$data['class_id']);
                }
            }
            if ($resource === 'sala_templates') {
                if ($op === 'insert') {
                    $this->ownPath($data['path'], $uid);
                    $data['processing_status'] = 'pending';
                } else {
                    unset($data['path'],$data['filename']);
                }
            }
            if ($resource === 'sala_exams') {
                if ($op === 'insert') {
                    $student = Student::ownedBy($uid)->findOrFail($data['student_id']);
                    $room = ClassRoom::ownedBy($uid)->findOrFail($data['class_id']);
                    abort_if($student->class_id !== $room->id || $student->archived_at || $room->archived_at, 409, 'Aluno ou turma indisponível.');
                    if (($data['purpose'] ?? 'regular') === 'recovery') {
                        abort_unless(DB::table('sala_recovery_students')->where('user_id', $uid)->where('student_id', $student->id)->exists(), 409);
                    }
                    $data['profile_snapshot'] = $student->only(['name', 'code', 'difficulties', 'criteria', 'level']);
                    $data['status'] = 'draft';
                } else {
                    unset($data['class_id'],$data['student_id'],$data['template_id'],$data['purpose']);
                    if (isset($data['content']) && $data['content'] !== $record->content || isset($data['title']) && $data['title'] !== $record->title || isset($data['subject']) && $data['subject'] !== $record->subject || isset($data['topics']) && $data['topics'] !== $record->topics) {
                        $data['status'] = 'draft';
                    }
                }
                $content = $data['content'] ?? $record->content;
                if (! empty($content['questions']) || ($data['status'] ?? $record->status) === 'approved') {
                    app(ExamValidator::class)->validate($content);
                }
                if (! empty($content['questions'])) {
                    $data['content'] = app(\App\Services\MathVerificationService::class)->verify($data['subject'] ?? $record->subject, $content);
                    $validator = app(ExamValidator::class);
                    $others = Exam::ownedBy($uid)->where('class_id', $data['class_id'] ?? $record->class_id)->where('title', $data['title'] ?? $record->title)->where('id', '!=', $record->id ?? '')->pluck('content');
                    $used = [];
                    foreach ($others as $other) {
                        foreach ($other['questions'] ?? [] as $question) {
                            $used[$validator->normalize($question['statement'])] = true;
                        }
                    }
                    foreach ($content['questions'] as $question) {
                        if (isset($used[$validator->normalize($question['statement'])])) {
                            $validator->fail('Há uma questão idêntica nesta avaliação. Edite-a antes de continuar.');
                        }
                    }
                }
            }
            $record->fill($data);
            $record->save();

            return response()->json(['data' => isset($input['single']) ? $record : [$record]]);
        });
    }

    public function ownPath(string $path, string $uid): void
    {
        abort_unless(str_starts_with($path, $uid.'/') && ! str_contains($path, '..') && ! str_contains($path, '\\') && preg_match('~^[a-zA-Z0-9_./-]+$~D', $path), 422, 'Caminho inválido.');
    }

    public function nextCode(string $classId): string
    {
        $max = 0;
        foreach (Student::where('class_id', $classId)->pluck('code') as $code) {
            if (preg_match('/^A(\d+)$/i', $code, $m)) {
                $max = max($max, (int) $m[1]);
            }
        }

        return 'A'.str_pad((string) ($max + 1), 3, '0', STR_PAD_LEFT);
    }

    private function shape($rows, array $input)
    {
        if (($input['single'] ?? null) === 'single') {
            abort_unless($rows->count() === 1, 404);
        }

return isset($input['single']) ? $rows->first() : $rows;
    }

    private function links(Request $r, string $table, string $uid, array $input)
    {
        $query = DB::table($table)->where('user_id', $uid);
        foreach ($input['filters'] ?? [] as $f) {
            abort_unless(in_array($f[0], ['user_id', 'student_id']), 422);
            $query->where($f[0], $f[1]);
        }
        if ($input['op'] === 'select') {
            return response()->json(['data' => $this->shape($query->get(), $input)]);
        }
        abort_unless($input['op'] === 'upsert', 405);
        $v = $input['values'] ?? [];
        if ($table === 'sala_teacher_template_defaults') {
            $id = $v['template_id'] ?? null;
            if ($id) {
                ExamTemplate::ownedBy($uid)->where('processing_status', 'ready')->findOrFail($id);
            }
            DB::table($table)->updateOrInsert(['user_id' => $uid], ['template_id' => $id, 'created_at' => now(), 'updated_at' => now()]);
        } else {
            $student = Student::ownedBy($uid)->whereNull('archived_at')->findOrFail($v['student_id'] ?? '');
            ClassRoom::ownedBy($uid)->whereNull('archived_at')->findOrFail($student->class_id);
            DB::table($table)->updateOrInsert(['student_id' => $student->id], ['user_id' => $uid, 'created_at' => now(), 'updated_at' => now()]);
        }

        return response()->json(['data' => null]);
    }

    private function rules(string $table, bool $creating): array
    {
        $req = $creating ? 'required' : 'sometimes';

        return match ($table) {
            'sala_classes' => ['name' => "$req|string|min:2|max:80", 'grade' => "$req|string|max:80", 'subject' => "$req|string|min:2|max:80", 'period' => 'sometimes|string|max:40', 'color' => 'sometimes|in:sage,peach,blue,lilac,rose,amber,teal,indigo,coral,slate', 'icon' => 'sometimes|in:book,users,graduation,science,sparkles,pencil,activity,geometry,projects,time', 'banner_path' => 'nullable|string|max:255', 'banner_crop' => 'nullable|array', 'banner_crop.x' => 'numeric|min:0|max:1', 'banner_crop.y' => 'numeric|min:0|max:1', 'banner_crop.zoom' => 'numeric|min:1|max:3', 'template_override_id' => 'nullable|uuid', 'use_provaai_template' => 'sometimes|boolean'],
            'sala_students' => ['name' => "$req|string|min:2|max:100", 'class_id' => "$req|uuid", 'code' => 'sometimes|string|max:30', 'difficulties' => 'sometimes|string|max:2000', 'criteria' => 'sometimes|string|max:2000', 'level' => 'sometimes|in:Em desenvolvimento,Intermediário,Avançado', 'archived_at' => 'nullable|date'],
            'sala_templates' => ['name' => "$req|string|min:1|max:150", 'filename' => "$req|string|max:255", 'path' => "$req|string|max:255", 'reference_text' => 'sometimes|string|max:60000', 'extracted_text' => $creating ? 'prohibited' : 'sometimes|string|max:60000'],
            'sala_exams' => ['class_id' => "$req|uuid", 'student_id' => "$req|uuid", 'template_id' => 'nullable|uuid', 'title' => "$req|string|max:150", 'subject' => "$req|string|max:80", 'topics' => "$req|string|max:10000", 'question_count' => "$req|integer|min:1|max:30", 'purpose' => 'sometimes|in:regular,recovery', 'status' => 'sometimes|in:draft,approved', 'content' => "$req|array", 'content.instructions' => 'present_with:content|string|max:10000', 'content.questions' => 'present_with:content|array|max:30', 'content.objectiveCount' => 'sometimes|integer|min:0|max:30'],
        };
    }
}
