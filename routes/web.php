<?php

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
Route::middleware('auth')->group(function () {
    Route::post('/api/data/{resource}', [RecordsController::class, 'handle']);
    Route::post('/api/actions/{action}', [ActionsController::class, 'handle']);
    Route::post('/api/files/{bucket}', [DocumentsController::class, 'upload']);
    Route::get('/api/files/{bucket}', [DocumentsController::class, 'download']);
    Route::delete('/api/files/{bucket}', [DocumentsController::class, 'remove']);
    Route::post('/api/template/process', [DocumentsController::class, 'process'])->middleware('throttle:60,1');
    Route::post('/api/export/exam', [DocumentsController::class, 'export']);
    Route::post('/api/generate', function (Request $r, AiService $ai) {
        $id = $r->validate(['examId' => 'required|uuid'])['examId'];
        try {
            return response()->json(['exam' => $ai->generate($r->user()->id, $id)]);
        } catch (RuntimeException $e) {
            return response()->json(['error' => ['message' => $e->getMessage()]], 502);
        }
    })->middleware('throttle:20,1');
    Route::post('/api/exam-batch', function (Request $r, BatchService $batches) {
        $batches->kick($r->user()->id);

        return response()->noContent(202);
    });
});
