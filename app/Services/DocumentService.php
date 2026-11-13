<?php

namespace App\Services;

use App\Models\ClassRoom;
use App\Models\Exam;
use App\Models\ExamTemplate;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;
use Symfony\Component\Process\Process;

class DocumentService
{
    public function run(array $input): array
    {
        $folder = storage_path('app/private/work');
        if (! is_dir($folder)) {
            mkdir($folder, 0700, true);
        }
        $path = $folder.'/'.Str::uuid().'.json';
        file_put_contents($path, json_encode($input, JSON_UNESCAPED_UNICODE));
        try {
            $process = new Process([config('provaai.node_binary'), '--experimental-strip-types', base_path('scripts/render-document.mjs'), $path], base_path());
            $process->setTimeout(120);
            $process->run();
            if (! $process->isSuccessful()) {
                if (str_contains($process->getErrorOutput(), 'PROVAAI_INVALID_MATH')) {
                    throw new RuntimeException('Confira as fórmulas na revisão da prova antes de baixar. Há uma expressão incompleta ou não suportada.');
                }
                throw new RuntimeException('Não foi possível converter o documento. Confira se ele está legível e sem senha.');
            }
            $lines = explode("\n", trim($process->getOutput()));
            try {
                return json_decode(end($lines), true, 64, JSON_THROW_ON_ERROR);
            } catch (\JsonException $e) {
                throw new RuntimeException('A resposta do conversor chegou incompleta. Tente novamente.', 0, $e);
            }
        } finally {
            @unlink($path);
        }
    }

    public function path(ExamTemplate $template): string
    {
        $path = 'sala-templates/'.$template->path;
        if (! Storage::disk('local')->exists($path)) {
            throw new RuntimeException('O arquivo do modelo não está disponível.');
        }

        return Storage::disk('local')->path($path);
    }

    public function header(ExamTemplate $template, float $ratio, bool $fitBoundary = false): array
    {
        if ($ratio < .05 || $ratio > .45) {
            throw new RuntimeException('Escolha um cabeçalho entre 5% e 45%.');
        }
        $path = $this->path($template);
        $key = 'pdf-header:'.$template->user_id.':'.hash_file('sha256', $path).':'.$ratio.($fitBoundary ? ':fit' : '');
        if ($cached = Cache::get($key)) {
            return $cached;
        }

        return Cache::lock($key.':lock', 130)->block(125, function () use ($path, $ratio, $key, $fitBoundary) {
            if ($cached = Cache::get($key)) {
                return $cached;
            }
            $result = $this->run(['operation' => 'header', 'templatePath' => $path, 'ratio' => $ratio, 'fitBoundary' => $fitBoundary]);
            if (strlen($result['image']) < 8 * 1024 * 1024) {
                Cache::put($key, $result, 300);
            }

            return $result;
        });
    }

    public function export(Exam $exam, User $user, string $format, bool $answerKey, ?callable $layoutReady = null): string
    {
        $template = $exam->template_id ? ExamTemplate::ownedBy($user->id)->findOrFail($exam->template_id) : null;
        $path = $template ? $this->path($template) : null;
        $className = ClassRoom::ownedBy($user->id)->findOrFail($exam->class_id)->name;
        $key = 'export:v4:'.hash('sha256', json_encode([$exam->toArray(), $user->name, $className, $answerKey,
            $template?->filename, $template?->pdf_header_ratio, $path ? hash_file('sha256', $path) : null]));
        $docx = fn () => $this->cachedDocument($key.':docx', function () use ($exam, $user, $template, $path, $className, $answerKey) {
            $header = $template && preg_match('/\.pdf$/i', $template->filename) ? $this->header($template, $template->pdf_header_ratio) : null;

            return $this->renderFile(['operation' => 'export', 'exam' => $exam->toArray(), 'className' => $className, 'teacherName' => $user->name,
                'format' => 'docx', 'answerKey' => $answerKey, 'templatePath' => $header ? null : $path, 'filename' => $template?->filename, 'header' => $header]);
        });
        if ($format === 'docx') {
            return $docx();
        }

        return $this->cachedDocument($key.':pdf', function () use ($docx, $layoutReady) {
            $bytes = $docx();
            if ($layoutReady) {
                $layoutReady();
            }
            $input = storage_path('app/private/').Str::uuid().'.docx';
            try {
                if (file_put_contents($input, $bytes) === false) {
                    throw new RuntimeException('Não foi possível preparar o documento para conversão.');
                }

                return $this->renderFile(['operation' => 'convert', 'docxPath' => $input]);
            } finally {
                @unlink($input);
            }
        });
    }

    private function renderFile(array $request): string
    {
        $output = storage_path('app/private/').Str::uuid().'.bin';
        try {
            $this->run($request + ['outputPath' => $output]);

            return file_get_contents($output);
        } finally {
            @unlink($output);
        }
    }

    private function cachedDocument(string $key, callable $render): string
    {
        if ($cached = Cache::get($key)) {
            return base64_decode($cached, true);
        }

        return Cache::lock($key.':lock', 150)->block(125, function () use ($key, $render) {
            if ($cached = Cache::get($key)) {
                return base64_decode($cached, true);
            }
            $bytes = $render();
            if (strlen($bytes) < 8 * 1024 * 1024) {
                Cache::put($key, base64_encode($bytes), 300);
            }

            return $bytes;
        });
    }
}
