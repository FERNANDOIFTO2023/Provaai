<?php

/*
 * Fila / etapa de geração
 * Obtém a reserva de uma prova, executa a geração e registra conclusão ou erro. O BatchService
 * agenda a etapa seguinte e impede que entregas duplicadas processem a mesma reserva.
 */


namespace App\Jobs;

use App\Services\AiService;
use App\Services\BatchService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Validation\ValidationException;

class GenerateBatchStep implements ShouldQueue
{
    use Queueable;

    public int $timeout = 125;

    public int $tries = 1;

    public function __construct(public string $userId, public string $batchId) {}

    /** Executa uma única prova reservada e finaliza a etapa mesmo quando a geração retorna erro. */
    public function handle(BatchService $batches, AiService $ai): void
    {
        $step = $batches->claim($this->userId, $this->batchId);
        if (! $step) {
            return;
        }
        $error = null;
        $failure = null;
        try {
            $ai->generate($this->userId, $step['id'], fn (string $stage) =>
                $batches->setStage($this->userId, $this->batchId, $step['lease'], $stage));
        } catch (\Throwable $e) {
            $error = $e instanceof ValidationException ? collect($e->errors())->flatten()->first() : $e->getMessage();
            $failure = $e;
        }
        // Libera a reserva e publica o resultado antes de tentar registrar a exceção.
        // Um destino de log sem permissão não deve deixar o professor esperando outra reserva.
        $batches->finish($this->userId, $this->batchId, $step['lease'], $error);
        if ($failure) {
            try {
                report($failure);
            } catch (\Throwable) {
                // O erro original já está no lote; não repete a geração nem mascara seu resultado.
            }
        }
    }
}
