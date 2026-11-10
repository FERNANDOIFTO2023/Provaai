<?php

namespace App\Http\Controllers;

use App\Models\ClassRoom;
use App\Models\CopyInvitation;
use App\Models\Student;
use App\Services\BatchService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class ActionsController extends Controller
{
    public function handle(Request $r, string $action)
    {
        $uid = $r->user()->id;
        $v = $r->all();

        return DB::transaction(function () use ($r, $action, $uid, $v) {
            DB::table('users')->where('id', $uid)->lockForUpdate()->first();
            $data = match ($action) {
                'sala_set_class_active' => $this->classActive($uid, $v),
                'sala_delete_class' => $this->deleteClass($uid, $v),
                'sala_reactivate_student' => $this->reactivate($uid, $v),
                'sala_send_copy' => $this->sendCopy($r, $v),
                'sala_accept_copy' => $this->acceptCopy($r, $v),
                'sala_cancel_copy' => $this->cancelCopy($uid, $v),
                'sala_begin_exam_batch' => app(BatchService::class)->begin($uid, $v['p_input'] ?? []),
                default => abort(404),
            };

            return response()->json(['data' => $data]);
        });
    }

    private function classActive(string $uid, array $v)
    {
        Validator::make($v, ['p_class' => 'required|uuid', 'p_active' => 'required|boolean'])->validate();
        $room = ClassRoom::ownedBy($uid)->lockForUpdate()->findOrFail($v['p_class']);
        abort_if($room->deletion_due_at && now()->gte($room->deletion_due_at), 409, 'O prazo de reativação terminou.');
        if ($v['p_active']) {
            $room->fill(['archived_at' => null, 'deletion_due_at' => null]);
        } elseif (! $room->archived_at) {
            $room->fill(['archived_at' => now(), 'deletion_due_at' => now()->addYearNoOverflow()]);
        }
        $room->save();

        return $room;
    }

    public function removeClass(ClassRoom $room, string $reason): void
    {
        abort_if(app(BatchService::class)->running($room->user_id), 409, 'Aguarde a geração em andamento.');
        DB::table('class_deletion_audits')->insert(['user_id' => $room->user_id, 'class_id' => $room->id, 'class_name' => $room->name, 'reason' => $reason, 'deleted_at' => now()]);
        $room->delete();
    }

    private function deleteClass(string $uid, array $v)
    {
        $v['p_reason'] = trim($v['p_reason'] ?? '');
        Validator::make($v, ['p_class' => 'required|uuid', 'p_reason' => 'required|string|min:5|max:1000'])->validate();
        $room = ClassRoom::ownedBy($uid)->findOrFail($v['p_class']);
        $this->removeClass($room, trim($v['p_reason']));

        return null;
    }

    private function reactivate(string $uid, array $v)
    {
        Validator::make($v, ['p_student' => 'required|uuid', 'p_class' => 'required|uuid'])->validate();
        $student = Student::ownedBy($uid)->lockForUpdate()->findOrFail($v['p_student']);
        $room = ClassRoom::ownedBy($uid)->whereNull('archived_at')->findOrFail($v['p_class']);
        if ($student->class_id !== $room->id) {
            $student->code = app(RecordsController::class)->nextCode($room->id);
        }
        $student->class_id = $room->id;
        $student->archived_at = null;
        $student->save();

        return $student;
    }

    private function sendCopy(Request $r, array $v)
    {
        Validator::make($v, ['p_id' => 'required|uuid', 'p_kind' => 'required|in:class,student', 'p_resource' => 'required|uuid', 'p_email' => 'required|email|max:254'])->validate();
        $email = mb_strtolower(trim($v['p_email']));
        abort_if($email === $r->user()->email, 422, 'Escolha outro professor.');
        $model = $v['p_kind'] === 'class' ? ClassRoom::class : Student::class;
        $resource = $model::ownedBy($r->user()->id)->findOrFail($v['p_resource']);
        $students = $v['p_kind'] === 'class' ? Student::ownedBy($r->user()->id)->where('class_id', $resource->id)->get() : collect([$resource]);
        $snapshot = ['students' => $students->map(fn ($s) => $s->only(['name', 'difficulties', 'criteria', 'level', 'archived_at']))->all()];
        if ($v['p_kind'] === 'class') {
            $snapshot['class'] = $resource->only(['name', 'grade', 'subject', 'period', 'color', 'icon']);
        }
        $existing = CopyInvitation::where('id', $v['p_id'])->first();
        if ($existing) {
            abort_unless($existing->owner_id === $r->user()->id, 404);

            return $existing->id;
        }
        $invite = new CopyInvitation;
        $invite->forceFill(['id' => $v['p_id'], 'owner_id' => $r->user()->id, 'sender_email' => $r->user()->email,
            'recipient_email' => $email, 'kind' => $v['p_kind'], 'resource_name' => $resource->name, 'student_count' => $students->count(), 'snapshot' => $snapshot])->save();

        return $invite->id;
    }

    private function acceptCopy(Request $r, array $v)
    {
        Validator::make($v, ['p_invitation' => 'required|uuid', 'p_class' => 'nullable|uuid'])->validate();
        $invite = CopyInvitation::where('recipient_email', $r->user()->email)->lockForUpdate()->findOrFail($v['p_invitation']);
        abort_if($invite->revoked_at, 409, 'Convite cancelado.');
        if ($invite->accepted_at) {
            return $invite->destination_id;
        }
        $uid = $r->user()->id;
        $snapshot = $invite->snapshot;
        if ($invite->kind === 'class') {
            $room = new ClassRoom;
            $room->forceFill([...$snapshot['class'], 'user_id' => $uid])->save();
        } else {
            $room = ClassRoom::ownedBy($uid)->whereNull('archived_at')->findOrFail($v['p_class'] ?? '');
        }
        foreach ($snapshot['students'] as $data) {
            $student = new Student;
            $student->forceFill([...$data, 'class_id' => $room->id, 'user_id' => $uid, 'code' => app(RecordsController::class)->nextCode($room->id)])->save();
        }
        $destination = $room->id;
        $invite->fill(['destination_id' => $destination, 'accepted_at' => now()])->save();

        return $destination;
    }

    private function cancelCopy(string $uid, array $v)
    {
        $invite = CopyInvitation::where('owner_id', $uid)->findOrFail($v['p_invitation'] ?? '');
        abort_if($invite->accepted_at,409,'A cópia já foi recebida.');
        $invite->revoked_at = now();
        $invite->save();

        return null;
    }
}
