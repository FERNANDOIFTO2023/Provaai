<?php

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

    public function handle(BatchService $batches, AiService $ai): void
    {
        $step = $batches->claim($this->userId, $this->batchId);
        if (! $step) {
            return;
        }$error = null;
        try {
            $ai->generate($this->userId, $step['id']);
        } catch (\Throwable $e) {
            $error = $e instanceof ValidationException ? collect($e->errors())->flatten()->first() : $e->getMessage();
            report($e);
        }
        $batches->finish($this->userId, $this->batchId, $step['lease'], $error);
    }
}
