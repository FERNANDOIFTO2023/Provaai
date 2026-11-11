<?php

namespace App\Services;

use App\Jobs\GenerateBatchStep;
use App\Models\ClassRoom;
use App\Models\Exam;
use App\Models\ExamBatch;
use App\Models\ExamTemplate;
use App\Models\Student;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class BatchService
{
    public function running(string $uid): bool
    {
        $b = ExamBatch::find($uid);

        return $b && $b->completed < count($b->exam_ids);
    }

    public function begin(string $uid, array $input): string
    {
        abort_if($this->running($uid), 409, 'Aguarde o lote em andamento.');
        if (array_key_exists('retry', $input)) {
            return $this->retryDraft($uid, $input);
        }
        $v = Validator::make($input, ['classId' => 'required|uuid', 'students' => 'required|array|min:1|max:100', 'students.*' => 'required|uuid|distinct', 'title' => 'required|string|max:150', 'subject' => 'required|string|max:80', 'topics' => 'required|string|max:10000', 'count' => 'required|integer|min:1|max:30', 'objectiveCount' => 'required|integer|min:0|max:30', 'choice' => 'required|string', 'purpose' => 'sometimes|in:regular,recovery'])->validate();
        abort_if($v['objectiveCount'] > $v['count'], 422, 'Distribuição inválida.');
        $room = ClassRoom::ownedBy($uid)->whereNull('archived_at')->findOrFail($v['classId']);
        $purpose = $v['purpose'] ?? 'regular';
        $template = $v['choice'] === 'inherit' ? DB::table('sala_teacher_template_defaults')->where('user_id', $uid)->value('template_id') : ($v['choice'] === 'builtin' ? null : $v['choice']);
        if (array_key_exists('expectedTemplateId', $input)) {
            abort_if($input['expectedTemplateId'] !== $template, 409, 'O modelo padrão mudou. Atualize a página e confira o modelo antes de gerar a prova.');
        }
        if ($template) {
            ExamTemplate::ownedBy($uid)->where('processing_status', 'ready')->findOrFail($template);
        }
        if ($purpose === 'recovery') {
            abort_unless(count($v['students']) === 1 && DB::table('sala_recovery_students')->where('user_id', $uid)->where('student_id', $v['students'][0])->exists(), 422, 'Escolha um aluno do acompanhamento individual.');
        } else {
            $room->fill(['template_override_id' => in_array($v['choice'], ['inherit', 'builtin']) ? null : $template, 'use_provaai_template' => $v['choice'] === 'builtin'])->save();
        }
        $ids = [];
        foreach ($v['students'] as $id) {
            $student = Student::ownedBy($uid)->where('class_id', $room->id)->whereNull('archived_at')->findOrFail($id);
            $exam = new Exam;
            $exam->forceFill(['user_id' => $uid, 'class_id' => $room->id, 'student_id' => $id, 'template_id' => $template, 'title' => $v['title'], 'subject' => $v['subject'], 'topics' => $v['topics'], 'question_count' => $v['count'], 'purpose' => $purpose, 'status' => 'draft',
                'content' => ['instructions' => 'Leia com atenção.', 'questions' => [], 'objectiveCount' => $v['objectiveCount']],
                'profile_snapshot' => $student->only(['name', 'code', 'difficulties', 'criteria', 'level'])])->save();
            $ids[] = $exam->id;
        }
        return $this->enqueue($uid, $v['title'], $ids);
    }

    private function retryDraft(string $uid, array $input): string
    {
        Validator::make($input, ['retry' => 'required|uuid'])->validate();
        $exam = Exam::ownedBy($uid)->lockForUpdate()->findOrFail($input['retry']);
        abort_unless($exam->status === 'draft' && empty($exam->content['questions']), 409, 'Só é possível gerar questões para um rascunho vazio.');
        abort_unless(ClassRoom::ownedBy($uid)->whereNull('archived_at')->whereKey($exam->class_id)->exists()
            && Student::ownedBy($uid)->where('class_id', $exam->class_id)->whereNull('archived_at')->whereKey($exam->student_id)->exists(),
            409, 'O aluno precisa estar ativo na turma desta prova.');
        if ($exam->template_id) {
            abort_unless(ExamTemplate::ownedBy($uid)->whereKey($exam->template_id)->where('processing_status', 'ready')->exists(), 409, 'Aguarde a leitura do modelo desta prova.');
        }
        $edits = Validator::make($input, [
            'objectiveCount' => 'sometimes|required|integer|min:0|max:'.$exam->question_count,
            'title' => 'sometimes|required|string|max:150',
            'instructions' => 'sometimes|nullable|string|max:2000',
        ])->validate();
        $content = $exam->content;
        if (isset($edits['objectiveCount'])) {
            $content['objectiveCount'] = (int) $edits['objectiveCount'];
        }
        if (array_key_exists('instructions', $edits)) {
            $content['instructions'] = $edits['instructions'] ?? '';
        }
        $exam->title = $edits['title'] ?? $exam->title;
        $exam->content = $content;
        $exam->save();

        return $this->enqueue($uid, $exam->title, [$exam->id]);
    }

    private function enqueue(string $uid, string $title, array $ids): string
    {
        $batchId = (string) Str::uuid();
        $batch = ExamBatch::find($uid) ?? new ExamBatch;
        $batch->forceFill(['user_id' => $uid, 'batch_id' => $batchId, 'title' => $title, 'exam_ids' => $ids, 'completed' => 0, 'failed' => 0, 'last_error' => null, 'lease' => null, 'lease_until' => null])->save();
        GenerateBatchStep::dispatch($uid, $batchId)->afterCommit();

        return $batchId;
    }

    public function kick(string $uid): void
    {
        $b = ExamBatch::find($uid);
        if ($b && $b->completed < count($b->exam_ids) && (! $b->lease_until || now()->gte($b->lease_until))) {
            GenerateBatchStep::dispatch($uid, $b->batch_id);
        }
    }

    public function claim(string $uid, string $batchId): ?array
    {
        return DB::transaction(function () use ($uid, $batchId) {
            $b = ExamBatch::where('batch_id', $batchId)->where('user_id', $uid)->lockForUpdate()->first();
            if (! $b || $b->completed >= count($b->exam_ids) || ($b->lease_until && now()->lt($b->lease_until))) {
                return null;
            }
            $b->lease = (string) Str::uuid();
            $b->lease_until = now()->addSeconds(150);
            $b->save();

            return ['id' => $b->exam_ids[$b->completed], 'lease' => $b->lease];
        });
    }

    public function finish(string $uid, string $batchId, string $lease, ?string $error): void
    {
        DB::transaction(function () use ($uid, $batchId, $lease, $error) {
            $b = ExamBatch::where('user_id', $uid)->where('batch_id', $batchId)->where('lease', $lease)->lockForUpdate()->first();
            if (! $b) {
                return;
            }
            $b->completed++;
            if ($error) {
                $b->failed++;
                $b->last_error = mb_substr($error, 0, 1000);
            }$b->lease = null;
            $b->lease_until = null;
            $b->save();
            if ($b->completed < count($b->exam_ids)) {
                GenerateBatchStep::dispatch($uid,$batchId)->afterCommit();
            }
        });
    }
}
