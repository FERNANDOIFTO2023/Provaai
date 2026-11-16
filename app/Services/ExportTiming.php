<?php

namespace App\Services;

use Illuminate\Support\Str;

/**
 * Diagnóstico de uma única exportação. Guarda somente durações e estados de cache;
 * nunca recebe conteúdo da prova, identificadores de alunos ou caminhos de arquivos.
 */
class ExportTiming
{
    public readonly string $id;

    private int $started;

    private array $durations = [];

    private array $cache = [];

    public function __construct()
    {
        $this->id = (string) Str::uuid();
        $this->started = hrtime(true);
    }

    /** Mede inclusive operações que falham e soma chamadas repetidas da mesma etapa. */
    public function measure(string $stage, callable $operation): mixed
    {
        $start = hrtime(true);
        try {
            return $operation();
        } finally {
            $this->durations[$stage] = ($this->durations[$stage] ?? 0) + (hrtime(true) - $start) / 1_000_000;
        }
    }

    /** Os nomes e estados vêm exclusivamente do código, nunca de parâmetros HTTP. */
    public function cache(string $kind, string $state): void
    {
        $this->cache[$kind] = $state;
    }

    /** Total desde a entrada no middleware; não inclui fila do PHP-FPM ou proxies. */
    public function finish(): void
    {
        $this->durations['app_total'] = (hrtime(true) - $this->started) / 1_000_000;
    }

    public function metrics(): array
    {
        return array_map(fn (float $ms) => round($ms, 2), $this->durations);
    }

    public function cacheStates(): array
    {
        return $this->cache;
    }

    /** Cabeçalho padrão, em milissegundos, que o navegador apresenta em Server Timing. */
    public function header(): string
    {
        $parts = [];
        foreach ($this->metrics() as $stage => $ms) {
            $parts[] = $stage.';dur='.number_format($ms, 2, '.', '');
        }
        foreach ($this->cache as $kind => $state) {
            $parts[] = $kind.'_cache;desc="'.$state.'"';
        }

        return implode(', ', $parts);
    }
}
