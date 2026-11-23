<?php

/*
 * Rotas / interface e API com sessão
 * Entrega o shell React e organiza os endpoints de autenticação e dados. As rotas de negócio estão
 * no grupo autenticado e usam a infraestrutura de sessão e CSRF do Laravel.
 */


use App\Http\Controllers\ActionsController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\DocumentsController;
use App\Http\Controllers\RecordsController;
use App\Services\AiService;
use App\Services\BatchService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::view('/', 'app')->name('login');
Route::get('/api/config', fn (AiService $ai) => response()->json(['aiConfigured' => $ai->configured(), 'backend' => 'laravel']));
Route::get('/api/auth/session', [AuthController::class, 'session']);
Route::post('/api/auth/code', [AuthController::class, 'code'])->middleware('throttle:30,1');
Route::post('/api/auth/logout', [AuthController::class, 'logout']);
// Todas as operações de dados e documentos abaixo exigem sessão autenticada.
Route::middleware('auth')->group(function () {
    Route::post('/api/students/import', \App\Http\Controllers\StudentImportController::class)->middleware('throttle:20,1');
    Route::post('/api/data/{resource}', [RecordsController::class, 'handle']);
    Route::post('/api/actions/{action}', [ActionsController::class, 'handle']);
    Route::post('/api/files/{bucket}', [DocumentsController::class, 'upload']);
    Route::get('/api/files/{bucket}', [DocumentsController::class, 'download']);
    Route::delete('/api/files/{bucket}', [DocumentsController::class, 'remove']);
    Route::post('/api/template/process', [DocumentsController::class, 'process'])->middleware('throttle:60,1');
    Route::post('/api/export/exam', [DocumentsController::class, 'export']);
    Route::get('/api/export/progress/{id}', [DocumentsController::class, 'progress'])->whereUuid('id');
    Route::post('/api/generate', function (Request $r, AiService $ai) {
        $id = $r->validate(['examId' => 'required|uuid'])['examId'];
        try {
            return response()->json(['exam' => $ai->generate($r->user()->id, $id)]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            // IDs alheios ou inexistentes continuam como 404, sem expor detalhes do modelo.
            // ModelNotFoundException também é RuntimeException; preserve a autorização antes do erro de IA.
            throw $e;
        } catch (RuntimeException $e) {
            return response()->json(['error' => ['message' => $e->getMessage()]], 502);
        }
    })->middleware('throttle:20,1');
    Route::post('/api/exam-batch', function (Request $r, BatchService $batches) {
        $batches->kick($r->user()->id);

        return response()->noContent(202);
    });
});
