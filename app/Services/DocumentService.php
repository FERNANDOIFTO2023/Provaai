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
                throw new RuntimeException('Não foi possível converter o documento. Confira se ele está legível e sem senha.');
            }
            $lines = explode("\n", trim($process->getOutput()));
            $result = json_decode(end($lines), true, 64, JSON_THROW_ON_ERROR);

            return $result;
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

    public function header(ExamTemplate $template, float $ratio): array
    {
        if ($ratio < .05 || $ratio > .45) {
            throw new RuntimeException('Escolha um cabeçalho entre 5% e 45%.');
        }
        $path = $this->path($template);
        $key = 'pdf-header:'.$template->user_id.':'.hash_file('sha256', $path).':'.$ratio;
        if ($cached = Cache::get($key)) {
            return $cached;
        }

        return Cache::lock($key.':lock', 130)->block(125, function () use ($path, $ratio, $key) {
            if ($cached = Cache::get($key)) {
                return $cached;
            }
            $result = $this->run(['operation' => 'header', 'templatePath' => $path, 'ratio' => $ratio]);
            if (strlen($result['image']) < 8 * 1024 * 1024) {
                Cache::put($key, $result, 300);
            }

            return $result;
        });
    }

    public function export(Exam $exam, User $user, string $format, bool $answerKey): string
    {
        $template = $exam->template_id ? ExamTemplate::ownedBy($user->id)->findOrFail($exam->template_id) : null;
        $path = $template ? $this->path($template) : null;
        $className = ClassRoom::ownedBy($user->id)->findOrFail($exam->class_id)->name;
        $key = 'export:'.hash('sha256', json_encode([$exam->toArray(), $user->name, $className, $format, $answerKey, $template?->pdf_header_ratio, $path ? hash_file('sha256', $path) : null]));
        $cached = Cache::get($key);
        if ($cached) {
            return base64_decode($cached, true);
        }

        return Cache::lock($key.':lock', 130)->block(125, function () use ($exam, $user, $format, $answerKey, $template, $path, $key, $className) {
            if ($cached = Cache::get($key)) {
                return base64_decode($cached, true);
            }
            $output = storage_path('app/private/').Str::uuid().'.'.$format;
            try {
                $header = $template && preg_match('/\.pdf$/i', $template->filename) ? $this->header($template, $template->pdf_header_ratio) : null;
                $this->run(['operation' => 'export', 'exam' => $exam->toArray(), 'className' => $className, 'teacherName' => $user->name,
                    'format' => $format, 'answerKey' => $answerKey, 'templatePath' => $header ? null : $path, 'filename' => $template?->filename, 'header' => $header, 'outputPath' => $output]);
                $bytes = file_get_contents($output);
                if (strlen($bytes) < 8 * 1024 * 1024) {
                    Cache::put($key, base64_encode($bytes), 300);
                }

return $bytes;
            } finally {
                @unlink($output);
            }
        });
    }
}
