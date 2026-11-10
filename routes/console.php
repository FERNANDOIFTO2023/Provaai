<?php

use App\Http\Controllers\ActionsController;
use App\Models\ClassRoom;
use App\Models\ExamBatch;
use App\Services\BatchService;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schedule;

Artisan::command('provaai:cleanup-classes', function () {
    $count = 0;
    ClassRoom::whereNotNull('archived_at')->where('deletion_due_at', '<=', now())->each(function ($room) use (&$count) {
        if (app(BatchService::class)->running($room->user_id)) {
            return;
        }
        DB::transaction(fn () => app(ActionsController::class)->removeClass($room, 'Exclusão automática após um ano de inatividade.'));
        $count++;
    });
    $this->info("Turmas expiradas removidas: $count");
})->purpose('Remove turmas após um ano de inatividade e registra o motivo.');
Artisan::command('provaai:resume-batches', function () {
    ExamBatch::each(fn ($b) => app(BatchService::class)->kick($b->user_id));
    $this->info('Lotes verificados.');
});
Schedule::command('provaai:cleanup-classes')->daily()->timezone('America/Sao_Paulo')->withoutOverlapping();
Schedule::command('provaai:resume-batches')->everyMinute()->withoutOverlapping();
