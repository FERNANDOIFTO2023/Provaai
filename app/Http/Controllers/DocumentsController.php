<?php

namespace App\Http\Controllers;

use App\Models\Exam;
use App\Models\ExamTemplate;
use App\Services\DocumentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;

class DocumentsController extends Controller
{
    public function process(Request $r, DocumentService $documents)
    {
        $v = $r->validate(['templateId' => 'required|uuid', 'headerRatio' => 'nullable|numeric|min:0.05|max:0.45', 'preview' => 'sometimes|boolean']);
        $t = ExamTemplate::ownedBy($r->user()->id)->findOrFail($v['templateId']);
        try {
            if (preg_match('/\.pdf$/i', $t->filename)) {
                $ratio = $v['headerRatio'] ?? $t->pdf_header_ratio;
                $firstCrop = $t->processing_status === 'pending' && !isset($v['headerRatio']) && empty($v['preview']);
                $header = $documents->header($t, $ratio, $firstCrop);
                if ($v['preview'] ?? false) {
                    return response(base64_decode($header['image'], true))->header('Content-Type', 'image/png')->header('Cache-Control', 'private, no-store');
                }
                $t->pdf_header_ratio = $firstCrop ? round($header['ratio'], 4) : $ratio;
                $t->extracted_text = '';
            } else {
                abort_unless(preg_match('/\.docx?$/i', $t->filename), 422);
                $t->extracted_text = $documents->run(['operation' => 'word', 'templatePath' => $documents->path($t)])['text'];
            }
            $t->processing_status = 'ready';
            $t->processing_error = null;
            $t->save();

            return response()->json(['template' => $t])->header('Cache-Control', 'no-store');
        } catch (\RuntimeException $e) {
            if (empty($v['preview']) && $t->processing_status !== 'ready') {
                $t->processing_status = 'error';
                $t->processing_error = $e->getMessage();
                $t->save();
            }

            return response()->json(['error' => ['message' => $e->getMessage()]], 422);
        }
    }

    public function export(Request $r, DocumentService $documents)
    {
        $v = $r->validate(['id' => 'required|uuid', 'format' => 'required|in:pdf,docx', 'answerKey' => 'sometimes|boolean', 'progressId' => 'sometimes|uuid']);
        $exam = Exam::ownedBy($r->user()->id)->findOrFail($v['id']);
        abort_unless($exam->status === 'approved', 409, 'Aprove a prova antes de exportar.');
        try {
            $layoutReady = null;
            if (isset($v['progressId'])) {
                $key = 'download:'.$r->user()->id.':'.$v['progressId'];
                Cache::put($key, 'approved', 180);
                $layoutReady = fn () => Cache::put($key, 'layout', 180);
            }
            $bytes = $documents->export($exam, $r->user(), $v['format'], $v['answerKey'] ?? false, $layoutReady);
        } catch (\RuntimeException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        } finally {
            if (isset($key)) {
                Cache::forget($key);
            }
        }

        return response($bytes)->header('Content-Type', $v['format'] === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
            ->header('X-Document-Length', strlen($bytes))->header('Cache-Control', 'private, no-store');
    }

    public function progress(Request $r, string $id)
    {
        return response()->json(['stage' => Cache::get('download:'.$r->user()->id.':'.$id)])
            ->header('Cache-Control', 'private, no-store');
    }

    public function upload(Request $r, string $bucket)
    {
        $this->bucket($bucket);
        $v = $r->validate(['path' => 'required|string|max:255', 'file' => 'required|file|max:20480']);
        app(RecordsController::class)->ownPath($v['path'], $r->user()->id);
        $file = $r->file('file');
        $ext = strtolower(pathinfo($v['path'], PATHINFO_EXTENSION));
        $prefix = file_get_contents($file->getRealPath(), false, null, 0, 8);
        $valid = $bucket === 'class-banners' ? ($ext === 'jpg' && @getimagesize($file->getRealPath()) !== false && $file->getMimeType() === 'image/jpeg') :
            match ($ext) {
                'pdf' => str_starts_with($prefix, '%PDF-'),'docx' => str_starts_with($prefix, 'PK'),'doc' => str_starts_with($prefix, "\xD0\xCF\x11\xE0"),default => false
            };
        abort_unless($valid, 422, 'O conteúdo não corresponde ao formato informado.');
        $path = $bucket.'/'.$v['path'];
        abort_if(Storage::disk('local')->exists($path), 409, 'Este arquivo já existe.');
        Storage::disk('local')->put($path, file_get_contents($file->getRealPath()));

        return response()->json(['data' => ['path' => $v['path']]]);
    }

    public function download(Request $r, string $bucket)
    {
        $this->bucket($bucket);
        $path = $r->validate(['path' => 'required|string|max:255'])['path'];
        app(RecordsController::class)->ownPath($path, $r->user()->id);
        abort_unless(Storage::disk('local')->exists($bucket.'/'.$path), 404);

        return Storage::disk('local')->response($bucket.'/'.$path, null, ['Cache-Control' => 'private, no-store', 'X-Content-Type-Options' => 'nosniff']);
    }

    public function remove(Request $r, string $bucket)
    {
        $this->bucket($bucket);
        $paths = $r->validate(['paths' => 'required|array|max:20', 'paths.*' => 'required|string|max:255'])['paths'];
        foreach ($paths as $path) {
            app(RecordsController::class)->ownPath($path, $r->user()->id);
            abort_if(ExamTemplate::ownedBy($r->user()->id)->where('path', $path)->exists(), 409, 'Arquivo vinculado a um modelo.');
        }
        foreach ($paths as $path) {
            Storage::disk('local')->delete($bucket.'/'.$path);
        }

return response()->json(['data' => null]);
    }

    private function bucket(string $bucket): void
    {
        abort_unless(in_array($bucket,['sala-templates', 'class-banners']),404);
    }
}
