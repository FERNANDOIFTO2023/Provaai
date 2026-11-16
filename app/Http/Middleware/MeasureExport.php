<?php

namespace App\Http\Middleware;

use App\Services\ExportTiming;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

/** Mede somente downloads de provas, incluindo sessão e autenticação no total. */
class MeasureExport
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->isMethod('POST') || ! $request->is('api/export/exam')) {
            return $next($request);
        }

        // O objeto pertence a esta requisição: não acumula dados entre professores ou downloads.
        $timing = new ExportTiming;
        $request->attributes->set(ExportTiming::class, $timing);
        $response = $next($request);
        $timing->finish();

        if ($request->user()) {
            $response->headers->set('Server-Timing', $timing->header());
            $response->headers->set('X-Export-Id', $timing->id);
            // O mesmo ID no navegador e no log permite localizar a execução sem dados pessoais.
            // Uma falha do destino de logs não pode impedir a entrega do documento pronto.
            try {
                Log::info('document_export_timing', [
                    'export_id' => $timing->id,
                    'status' => $response->getStatusCode(),
                    'duration_ms' => $timing->metrics(),
                    'cache' => $timing->cacheStates(),
                ]);
            } catch (\Throwable) {
                // O diagnóstico continua disponível nos cabeçalhos da resposta.
            }
        }

        return $response;
    }
}
