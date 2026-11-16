<?php

namespace App\Jobs;

use App\Models\Exam;
use App\Models\User;
use App\Services\DocumentService;
use App\Services\ExportTiming;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;

/** Antecipa uma variante do download. O PDF também deixa o DOCX correspondente pronto. */
class PrepareExamDownload implements ShouldQueue
{
    use Queueable;

    // A conexão dedicada reserva por 480 s, sempre mais que o timeout de 420 s do trabalho.
    public int $timeout = 420;

    public int $tries = 1;

    public bool $failOnTimeout = true;

    public function __construct(public string $userId, public string $examId, public bool $answerKey)
    {
        // Nunca usa a conexão sync: aprovar uma prova não pode esperar pela conversão.
        $this->onConnection('documents')->onQueue('documents')->afterCommit();
    }

    public function handle(DocumentService $documents): void
    {
        // Busca o estado atual; uma prova excluída ou devolvida à revisão não é exportada.
        $user = User::find($this->userId);
        $exam = Exam::ownedBy($this->userId)->where('status', 'approved')->find($this->examId);
        if (! $user || ! $exam) {
            return;
        }
        $timing = new ExportTiming;
        $ok = false;
        try {
            $documents->export($exam, $user, 'pdf', $this->answerKey, null, $timing);
            $ok = true;
        } finally {
            $timing->finish();
            try {
                Log::info('document_export_prepared', ['export_id' => $timing->id, 'ok' => $ok,
                    'duration_ms' => $timing->metrics(), 'cache' => $timing->cacheStates()]);
            } catch (\Throwable) {
                // Uma indisponibilidade do log não invalida o documento já preparado.
            }
        }
    }
}
