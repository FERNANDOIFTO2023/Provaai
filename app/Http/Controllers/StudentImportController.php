<?php

namespace App\Http\Controllers;

use App\Models\ClassRoom;
use App\Models\Student;
use App\Services\StudentSpreadsheet;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Prévia e confirmação usam a mesma validação; dados enviados pelo navegador nunca substituem a planilha. */
class StudentImportController extends Controller
{
    public function __invoke(Request $request, StudentSpreadsheet $spreadsheet, RecordsController $records)
    {
        $input = $request->validate([
            'class_id' => 'required|uuid',
            'preview' => 'required|boolean',
            'file' => 'required|file|extensions:xlsx|max:5120',
        ], ['file.max' => 'O arquivo deve ter até 5 MB.', 'file.extensions' => 'Envie o modelo no formato .xlsx.']);
        $uid = $request->user()->id;
        // Verifica a propriedade antes de gastar recursos na leitura do arquivo.
        $room = ClassRoom::ownedBy($uid)->findOrFail($input['class_id']);
        abort_if($room->archived_at, 409, 'Reative a turma antes de importar alunos.');
        $parsed = $spreadsheet->read($request->file('file')->getPathname());

        return DB::transaction(function () use ($request, $input, $uid, $parsed, $records) {
            // É o mesmo bloqueio do cadastro manual: duas importações/cadastros não disputam códigos.
            DB::table('users')->where('id', $uid)->lockForUpdate()->first();
            $room = ClassRoom::ownedBy($uid)->findOrFail($input['class_id']);
            abort_if($room->archived_at, 409, 'Reative a turma antes de importar alunos.');
            $existing = Student::where('class_id', $room->id)->pluck('name')
                ->mapWithKeys(fn ($name) => [StudentSpreadsheet::nameKey($name) => true])->all();
            $errors = $parsed['errors'];
            foreach ($parsed['students'] as $student) {
                if (isset($existing[StudentSpreadsheet::nameKey($student['name'])])) {
                    $errors[] = ['line' => $student['line'], 'message' => 'Já existe um aluno com esse nome na turma, ativo ou inativo. Confira o cadastro; homônimos podem ser cadastrados manualmente.'];
                }
            }
            if ($errors) {
                return response()->json(['message' => 'Corrija as linhas indicadas e envie novamente. Nenhum aluno foi cadastrado.', 'errors' => $errors], 422);
            }
            if ($request->boolean('preview')) {
                return response()->json(['students' => $parsed['students'], 'count' => count($parsed['students'])]);
            }
            // A transação salva tudo ou nada. Reenvios da mesma lista são barrados pela conferência de nomes.
            $next = (int) substr($records->nextCode($room->id), 1);
            $created = [];
            foreach ($parsed['students'] as $student) {
                unset($student['line']);
                $record = new Student;
                $record->forceFill([
                    ...$student, 'user_id' => $uid, 'class_id' => $room->id,
                    'code' => 'A'.str_pad((string) $next++, 3, '0', STR_PAD_LEFT),
                ])->save();
                $created[] = $record;
            }

            return response()->json(['students' => $created, 'count' => count($created)], 201);
        });
    }
}
