<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

/**
 * Arquivos prontos no volume privado, sem guardar PDFs em base64 no banco.
 * Cada chave representa uma versão completa do documento. O prazo limita o acúmulo
 * de versões antigas; a autorização continua obrigatória no endpoint de download.
 */
class ExportArtifacts
{
    public const RETENTION_SECONDS = 7 * 86400;

    private function path(string $key): string
    {
        $hash = hash('sha256', $key);

        return 'export-artifacts/'.substr($hash, 0, 2).'/'.$hash.'.bin';
    }

    public function get(string $key): ?string
    {
        $disk = Storage::disk('local');
        $path = $this->path($key);
        try {
            if (! $disk->exists($path) || $disk->lastModified($path) <= now()->timestamp - self::RETENTION_SECONDS) {
                return null;
            }
            $bytes = $disk->get($path);
        } catch (\League\Flysystem\UnableToReadFile|\League\Flysystem\UnableToRetrieveMetadata) {
            // Uma limpeza concorrente é equivalente à ausência do cache, não à perda da prova.
            return null;
        }

        return str_starts_with($bytes, '%PDF-') || str_starts_with($bytes, 'PK') ? $bytes : null;
    }

    /** Publica por rename: outra requisição nunca deve enxergar um arquivo pela metade. */
    public function put(string $key, string $bytes): void
    {
        $disk = Storage::disk('local');
        $path = $this->path($key);
        $disk->makeDirectory(dirname($path));
        $target = $disk->path($path);
        $temporary = tempnam(dirname($target), 'writing-');
        if ($temporary === false) {
            throw new RuntimeException('Não foi possível reservar o arquivo de download.');
        }
        try {
            if (file_put_contents($temporary, $bytes) !== strlen($bytes)) {
                throw new RuntimeException('Não foi possível guardar o download completo.');
            }
            @chmod($temporary, 0600);
            // A limpeza usa o mesmo bloqueio curto, separado da reserva longa de conversão.
            Cache::lock('export-file:'.basename($path), 10)->block(5, function () use ($temporary, $target) {
                if (! rename($temporary, $target)) {
                    throw new RuntimeException('Não foi possível disponibilizar o download.');
                }
            });
        } finally {
            if (is_file($temporary)) {
                unlink($temporary);
            }
        }
    }

    /** Remove somente artefatos vencidos da pasta exclusiva, sem tocar nos modelos enviados. */
    public function prune(): int
    {
        $disk = Storage::disk('local');
        $removed = 0;
        foreach ($disk->allFiles('export-artifacts') as $path) {
            if (! preg_match('~^export-artifacts/[a-f0-9]{2}/([a-f0-9]{64}\.bin|writing-[a-zA-Z0-9.]+)$~D', $path)) {
                continue;
            }
            Cache::lock('export-file:'.basename($path), 10)->get(function () use ($disk, $path, &$removed) {
                if ($disk->exists($path) && $disk->lastModified($path) <= now()->timestamp - self::RETENTION_SECONDS) {
                    $removed += (int) $disk->delete($path);
                }
            });
        }

        return $removed;
    }
}
