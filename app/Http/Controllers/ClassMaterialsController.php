<?php

namespace App\Http\Controllers;

use App\Models\ClassMaterial;
use App\Models\ClassRoom;
use App\Services\DocumentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/** Todo acesso exige propriedade da turma e do arquivo; originais ficam no disco privado. */
class ClassMaterialsController extends Controller
{
    /** Lista apenas textos já extraídos, permitindo ao professor conferir a leitura antes de gerar. */
    public function index(Request $r, string $classId)
    {
        $room = ClassRoom::ownedBy($r->user()->id)->findOrFail($classId);
        return response()->json(['materials' => ClassMaterial::ownedBy($r->user()->id)->where('class_id', $room->id)->orderBy('created_at')->get(),
            'allow_external_sources' => $room->allow_external_sources, 'external_search_available' => (bool) config('provaai.gemini_key')])
            ->header('Cache-Control', 'private, no-store');
    }

    /** Publica o arquivo e seu texto juntos; falhas de leitura ou limites removem o original temporário. */
    public function upload(Request $r, string $classId, DocumentService $documents)
    {
        $uid = $r->user()->id;
        $room = ClassRoom::ownedBy($uid)->findOrFail($classId);
        abort_if($room->archived_at, 409, 'Reative a turma para alterar os materiais.');
        $r->validate(['file' => 'required|file|max:20480|extensions:pdf,doc,docx,ppt,pptx']);
        $file = $r->file('file');
        $ext = strtolower($file->getClientOriginalExtension());
        $name = basename(str_replace('\\', '/', $file->getClientOriginalName()));
        abort_if(mb_strlen($name) > 255, 422, 'Use um nome de arquivo com até 255 caracteres.');
        $path = 'class-materials/'.$uid.'/'.$classId.'/'.Str::uuid().'.'.$ext;
        // Lê uma vez no envio, fora da transação. Só publica o material após a extração completa.
        Storage::disk('local')->putFileAs(dirname($path), $file, basename($path));
        try {
            try {
                $result = $documents->run(['operation' => 'class-material', 'templatePath' => Storage::disk('local')->path($path), 'extension' => $ext]);
            } catch (\RuntimeException $e) {
                throw ValidationException::withMessages(['file' => 'Não foi possível ler o material. Confira se está sem senha e com texto selecionável. PowerPoint com animações avançadas pode falhar; exporte uma versão simples em PDF.']);
            }
            $text = trim($result['text'] ?? '');
            if (mb_strlen($text) < 40 || mb_strlen($text) > 60000) {
                throw ValidationException::withMessages(['file' => 'Use texto selecionável entre 40 e 60.000 caracteres. PDFs digitalizados precisam de OCR antes do envio.']);
            }
            $material = DB::transaction(function () use ($uid, $classId, $name, $path, $file, $text) {
                DB::table('users')->where('id', $uid)->lockForUpdate()->first();
                $room = ClassRoom::ownedBy($uid)->findOrFail($classId);
                abort_if($room->archived_at, 409, 'Reative a turma para alterar os materiais.');
                $existing = ClassMaterial::ownedBy($uid)->where('class_id', $classId)->get();
                abort_if($existing->count() >= 5 || $existing->sum(fn ($m) => mb_strlen($m->extracted_text)) + mb_strlen($text) > 60000,
                    422, 'Use até 5 arquivos e 60.000 caracteres de texto no total por turma.');
                $material = new ClassMaterial;
                $material->forceFill(['user_id' => $uid, 'class_id' => $classId, 'filename' => $name, 'path' => $path,
                    'size' => $file->getSize(), 'extracted_text' => $text])->save();
                return $material;
            });
            return response()->json(['material' => $material], 201);
        } catch (\Throwable $e) {
            Storage::disk('local')->delete($path);
            throw $e;
        }
    }

    /** Persiste a permissão explícita para pesquisar; os rascunhos existentes mantêm sua própria versão. */
    public function settings(Request $r, string $classId)
    {
        $v = $r->validate(['allow_external_sources' => 'required|boolean']);
        return DB::transaction(function () use ($r, $classId, $v) {
            DB::table('users')->where('id', $r->user()->id)->lockForUpdate()->first();
            $room = ClassRoom::ownedBy($r->user()->id)->findOrFail($classId);
            abort_if($room->archived_at, 409, 'Reative a turma para alterar os materiais.');
            abort_if($v['allow_external_sources'] && !config('provaai.gemini_key'), 422, 'A pesquisa externa precisa do Gemini configurado no servidor.');
            $room->fill($v)->save();
            return response()->json(['allow_external_sources' => $room->allow_external_sources]);
        });
    }

    /** Retira a fonte das próximas provas sem modificar o contexto congelado das anteriores. */
    public function remove(Request $r, string $classId, string $materialId)
    {
        return DB::transaction(function () use ($r, $classId, $materialId) {
            DB::table('users')->where('id', $r->user()->id)->lockForUpdate()->first();
            $room = ClassRoom::ownedBy($r->user()->id)->findOrFail($classId);
            abort_if($room->archived_at, 409, 'Reative a turma para alterar os materiais.');
            $material = ClassMaterial::ownedBy($r->user()->id)->where('class_id', $room->id)->findOrFail($materialId);
            $path = $material->getRawOriginal('path');
            $material->delete();
            DB::afterCommit(fn () => Storage::disk('local')->delete($path));
            return response()->noContent();
        });
    }

    /** Serve o original autenticado, sem expor o caminho físico nem criar um endereço público. */
    public function download(Request $r, string $classId, string $materialId)
    {
        ClassRoom::ownedBy($r->user()->id)->findOrFail($classId);
        $material = ClassMaterial::ownedBy($r->user()->id)->where('class_id', $classId)->findOrFail($materialId);
        return Storage::disk('local')->download($material->getRawOriginal('path'), $material->filename,
            ['Cache-Control' => 'private, no-store', 'X-Content-Type-Options' => 'nosniff']);
    }
}
