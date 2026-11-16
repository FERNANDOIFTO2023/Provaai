<?php

/*
 * Rotas / manutenção agendada
 * Remove turmas cujo prazo de arquivamento terminou e retoma lotes sem execução ativa. As rotinas
 * reutilizam os serviços de negócio para preservar auditoria e controle de concorrência.
 */


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

Artisan::command('provaai:cleanup-downloads', function () {
    $count = app(\App\Services\ExportArtifacts::class)->prune();
    $this->info("Arquivos de download expirados removidos: $count");
})->purpose('Limpa versões de downloads com mais de sete dias no armazenamento privado.');
Schedule::command('provaai:cleanup-downloads')->daily()->withoutOverlapping();

Artisan::command('provaai:prepare-downloads {--limit=100}', function () {
    $limit = filter_var($this->option('limit'), FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 1000]]);
    if ($limit === false) {
        $this->error('Use --limit entre 1 e 1000.');
        return 1;
    }
    $exams = \App\Models\Exam::where('status', 'approved')->latest('updated_at')->limit($limit)->get(['id', 'user_id']);
    foreach ($exams as $exam) {
        foreach ([false, true] as $answerKey) {
            \App\Jobs\PrepareExamDownload::dispatch($exam->user_id, $exam->id, $answerKey);
        }
    }
    $this->info('Provas agendadas: '.$exams->count().'. Aguarde o trabalhador documents concluir a preparação.');
})->purpose('Prepara prova e gabarito das aprovações recentes, inclusive anteriores a esta versão.');
